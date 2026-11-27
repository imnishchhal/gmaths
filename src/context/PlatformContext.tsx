import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFirebase } from './FirebaseContext';
import {
  provisionAgentAuthAccount,
  provisionPhoneAuthAccount,
} from '../lib/firebase';
import {
  cloudCreateAgent,
  cloudCreateChild,
  cloudCreateOfflineVoucher,
  cloudCreateParent,
  cloudCreatePayoutRequest,
  cloudCreatePracticeSession,
  cloudCreateStudentSubscription,
  cloudCreateSubscription,
  cloudCreateTrialLead,
  cloudDeletePortalLogin,
  cloudLookupAndRedeemVoucher,
  cloudLookupPortalLogin,
  cloudMarkPayoutPaid,
  cloudSaveAppConfig,
  cloudSyncPortalLogin,
  cloudUpdateAgent,
  cloudUpdateAgentPassword,
  cloudUpdateAgentSelfProfile,
  cloudUpdateChildLeaderboardVisibility,
  cloudUpdateChildScoreAndLeaderboard,
  cloudUpdateLeadStatus,
  cloudUpdateParentPassword,
  cloudUpdateSubscription,
  lookupReferralCodeCloud,
  resolveUserRoleFromFirestore,
  subscribeAppConfig,
  subscribeChildChampions,
  subscribePlatformWorkspace,
} from '../lib/platformStorage';
import { cloudUpdateLeaderboardModeration } from '../lib/storage';
import {
  getFreeAdaptiveUsedCount,
  incrementFreeAdaptiveUsedCount,
  loadCustomPresets,
  loadLocalGrowthState,
  saveCustomPresetItem,
  deleteCustomPresetItem,
  saveLocalGrowthState,
} from '../lib/localGrowthStore';
import {
  ANNUAL_PLAN_PRICE_INR,
  AgentApprovalStatus,
  AgentProfile,
  AppGlobalConfig,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildLeaderboardEntry,
  ChildOnboardingInput,
  ChildProfile,
  DEFAULT_APP_CONFIG,
  OfflineVoucher,
  PAYOUT_MINIMUM_INR,
  ParentProfile,
  PaymentMethod,
  PayoutRequest,
  PlatformRoute,
  PracticeSession,
  REFERRAL_DISCOUNT_INR,
  ReferralCodePublic,
  RoleSession,
  StudentSubscription,
  SubscriptionRecord,
  SubscriptionStatus,
  TrialLead,
  WORKSPACE_ID,
  WeakTopic,
  addOneYearIso,
  computeAgentCommissionSummary,
  evaluateSubscriptionState,
  getAgentApprovalStatus,
  getCommissionForNextConversion,
  isSameCalendarMonth,
  isStudentSubscriptionActive,
  todayIsoDate,
} from '../types/platform';
import {
  ConcreteOperation,
  CustomPreset,
  DrillConfig,
  SessionRecord,
  normalizeIndianClass,
} from '../types/math';
import { hashSecret, verifySecret } from '../utils/crypto';
import {
  buildAgentAuthEmail,
  buildParentAuthEmail,
  buildPortalLoginToken,
  buildVersionedPhoneAuthEmail,
  captureReferralFromCurrentUrl,
  hashContactForAttribution,
  isPhoneAgentAuthEmail,
  isPhoneAuthEmail,
  isPhoneParentAuthEmail,
  loadStickyReferral,
  normalizeEmailForMatch,
  normalizePhoneDigits,
  normalizePhoneForMatch,
  saveStickyReferral,
} from '../utils/referral';

const ACTIVE_CHILD_SESSION_KEY = 'gmaths_active_child_session_v1';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part = '';
  for (let i = 0; i < 6; i += 1) {
    part += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GM-${part}`;
}

function buildPasswordCandidates(raw: string): string[] {
  const list: string[] = [];
  if (raw) list.push(raw);
  const trimmed = raw.trim();
  if (trimmed && !list.includes(trimmed)) list.push(trimmed);
  return list;
}

async function verifyDocPassword(
  doc: { password?: string; passcodeHash: string },
  candidates: string[]
): Promise<boolean> {
  if (typeof doc.password === 'string' && doc.password.length > 0) {
    const docTrimmed = doc.password.trim();
    return candidates.some(
      (cand) => cand === doc.password || (docTrimmed.length > 0 && cand.trim() === docTrimmed)
    );
  }
  for (const cand of candidates) {
    if (await verifySecret(cand, doc.passcodeHash)) {
      return true;
    }
  }
  return false;
}

function loadActiveChildSession(): RoleSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ACTIVE_CHILD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoleSession;
    if (parsed && parsed.role === 'child' && parsed.accountId) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveActiveChildSession(session: RoleSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (session && session.role === 'child') {
      window.sessionStorage.setItem(
        ACTIVE_CHILD_SESSION_KEY,
        JSON.stringify(session)
      );
    } else {
      window.sessionStorage.removeItem(ACTIVE_CHILD_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  agentId: string;
  agentName: string;
  agentEmail?: string;
  isSelfReferral: boolean;
  message: string;
}

export interface ChildStatsSummary {
  totalScore: number;
  totalSessions: number;
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  bestStreak: number;
  avgResponseMs: number;
  weakTopics: Array<{
    topic: ConcreteOperation;
    sessionsFlagged: number;
    avgAccuracy: number;
  }>;
  recentSessions: PracticeSession[];
}

interface PlatformContextValue {
  agents: AgentProfile[];
  parents: ParentProfile[];
  children: ChildProfile[];
  subscriptions: SubscriptionRecord[];
  practiceSessions: PracticeSession[];
  leads: TrialLead[];
  studentSubscriptions: StudentSubscription[];
  payoutRequests: PayoutRequest[];
  vouchers: OfflineVoucher[];
  appConfig: AppGlobalConfig;

  topChampions: ChildLeaderboardEntry[];
  topChampionsLoading: boolean;
  topChampionsError: string | null;
  childLeaderboard: ChildLeaderboardEntry[];
  platformLoading: boolean;
  roleSession: RoleSession | null;
  autoRouteEvent: { seq: number; route: PlatformRoute } | null;
  roleResolveNotice: string | null;
  platformError: string | null;
  isGoogleAdmin: boolean;
  dismissPlatformError: () => void;
  dismissRoleResolveNotice: () => void;

  // Paywall, Presets & Sticky Referral
  capturedReferralCode: string;
  isProSubscriber: boolean;
  myStudentSubscription: StudentSubscription | undefined;
  freeAdaptiveUsedCount: number;
  markFreeAdaptiveUsed: () => void;
  customPresets: CustomPreset[];
  saveCustomPreset: (name: string, config: DrillConfig) => void;
  deleteCustomPreset: (presetId: string) => void;
  isCheckoutOpen: boolean;
  checkoutInitialTab: 'plan' | 'voucher';
  openCheckoutModal: (tab?: 'plan' | 'voucher') => void;
  closeCheckoutModal: () => void;
  validatePromoCode: (
    rawCode: string,
    buyerEmail?: string,
    buyerPhone?: string
  ) => Promise<PromoValidationResult>;
  completeAnnualCheckout: (input: {
    subscriberName: string;
    subscriberEmail: string;
    subscriberPhone: string;
    paymentMethod: 'upi' | 'card';
    promoCode?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    subscription?: StudentSubscription;
  }>;
  redeemOfflineVoucher: (input: {
    voucherCode: string;
    subscriberName?: string;
    subscriberPhone?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    subscription?: StudentSubscription;
  }>;
  recordTrialLeadIfReferred: (
    name: string,
    email: string,
    phone?: string
  ) => Promise<void>;

  // Role Authentication (Mobile+Password for Agents & Parents, Google for Admin/Optional)
  signInAndRouteWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogleRedirectFlow: () => Promise<void>;
  loginAgentPhonePassword: (
    phone: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginAgentPasscode: (
    identifier: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginParentPhonePassword: (
    phone: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginParentPasscode: (
    contact: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  registerSalesAgent: (input: {
    name: string;
    phone: string;
    password: string;
    city: string;
    upiId: string;
    agentCode?: string;
  }) => Promise<{ ok: boolean; error?: string; agent?: AgentProfile }>;
  updateAgentSelfProfile: (
    agentId: string,
    patch: { name: string; phone: string; city: string; upiId: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  changeAgentPassword: (
    agentId: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  changeParentPassword: (
    parentId: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  requestAgentPayout: (
    agentId: string,
    amount: number,
    upiId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  switchToChildMode: (childId: string) => {
    ok: boolean;
    error?: string;
    child?: ChildProfile;
  };
  exitChildModeToParent: () => void;
  logoutRole: () => Promise<void>;

  // Admin Operations
  createAgent: (input: {
    agentCode: string;
    name: string;
    phone: string;
    email: string;
    assignedArea: string;
    city?: string;
    upiId?: string;
    commissionRate: number;
    commissionPerConversion?: number;
    defaultYearlyFee: number;
    passcode: string;
  }) => Promise<{ ok: boolean; error?: string; agent?: AgentProfile }>;
  updateAgent: (
    agentId: string,
    updates: {
      agentCode: string;
      name: string;
      phone: string;
      email: string;
      assignedArea: string;
      city?: string;
      upiId?: string;
      approvalStatus?: AgentApprovalStatus;
      commissionRate: number;
      commissionPerConversion?: number;
      defaultYearlyFee: number;
      newPasscode?: string;
      isActive: boolean;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleAgentActive: (agentId: string) => Promise<void>;
  setAgentApprovalStatus: (
    agentId: string,
    status: AgentApprovalStatus,
    commissionPerConversion?: number,
    commissionRate?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  adminOverrideSubscription: (
    parentId: string,
    action: 'activate' | 'extend_year' | 'suspend'
  ) => Promise<{ ok: boolean; error?: string }>;
  markPayoutPaid: (
    payoutId: string,
    utrNumber: string
  ) => Promise<{ ok: boolean; error?: string }>;
  generateOfflineVoucher: (
    agentId?: string
  ) => Promise<{ ok: boolean; error?: string; voucher?: OfflineVoucher }>;
  updateAppConfig: (patch: {
    dailyChallengeSeed: string;
    announcementEnabled: boolean;
    announcementText: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  moderateLeaderboardEntry: (
    entryId: string,
    patch: { isHidden?: boolean; isFlagged?: boolean; flagReason?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  moderateChildChampion: (
    childId: string,
    isHidden: boolean
  ) => Promise<{ ok: boolean; error?: string }>;

  // Agent Operations
  onboardParentAccount: (input: {
    agentId: string;
    parentName: string;
    parentContact: string;
    parentEmail: string;
    parentPasscode: string;
    children: ChildOnboardingInput[];
    feeAmount: number;
    paymentMethod: PaymentMethod;
    receiptNote: string;
    startDate: string;
  }) => Promise<{ ok: boolean; error?: string; parent?: ParentProfile }>;
  addChildToParent: (
    parentId: string,
    agentId: string,
    child: ChildOnboardingInput
  ) => Promise<{ ok: boolean; error?: string }>;
  renewParentSubscription: (input: {
    parentId: string;
    agentId: string;
    feeAmount: number;
    paymentMethod: PaymentMethod;
    receiptNote: string;
    startDate: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  // Child Practice Tracking
  recordChildPractice: (
    childId: string,
    session: SessionRecord
  ) => Promise<boolean>;

  // Query Selectors
  getAgentById: (agentId: string) => AgentProfile | undefined;
  getParentById: (parentId: string) => ParentProfile | undefined;
  getChildById: (childId: string) => ChildProfile | undefined;
  getChildrenForParent: (parentId: string) => ChildProfile[];
  getLatestSubscriptionForParent: (
    parentId: string
  ) => SubscriptionRecord | undefined;
  getSubscriptionHistoryForParent: (parentId: string) => SubscriptionRecord[];
  getChildStats: (childId: string) => ChildStatsSummary;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({
  children: reactChildren,
}) => {
  const {
    user,
    authReady,
    isConfigured,
    googleSignInSeq,
    signInWithGoogle,
    signInWithGoogleRedirect,
    signInWithPhoneCredentials,
    signInOrProvisionTokenAccount,
    changeCurrentPassword,
    signOutUser,
  } = useFirebase();

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [leads, setLeads] = useState<TrialLead[]>([]);
  const [studentSubscriptions, setStudentSubscriptions] = useState<
    StudentSubscription[]
  >([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [vouchers, setVouchers] = useState<OfflineVoucher[]>([]);
  const [appConfig, setAppConfig] = useState<AppGlobalConfig>(
    DEFAULT_APP_CONFIG
  );
  const [platformLoading, setPlatformLoading] = useState<boolean>(false);

  const [topChampions, setTopChampions] = useState<ChildLeaderboardEntry[]>([]);
  const [topChampionsLoading, setTopChampionsLoading] = useState<boolean>(true);
  const [topChampionsError, setTopChampionsError] = useState<string | null>(null);
  const [childLeaderboard, setChildLeaderboard] = useState<
    ChildLeaderboardEntry[]
  >([]);

  const [roleSession, setRoleSession] = useState<RoleSession | null>(() =>
    loadActiveChildSession()
  );
  const [autoRouteEvent, setAutoRouteEvent] = useState<{
    seq: number;
    route: PlatformRoute;
  } | null>(null);
  const [roleResolveNotice, setRoleResolveNotice] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);

  // Sticky Referral & Checkout Modal state
  const [capturedReferralCode, setCapturedReferralCode] = useState<string>(() =>
    captureReferralFromCurrentUrl() || loadStickyReferral()?.code || ''
  );
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [checkoutInitialTab, setCheckoutInitialTab] = useState<'plan' | 'voucher'>('plan');

  const scopeKey = user?.uid || roleSession?.accountId || 'guest';
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() =>
    loadCustomPresets(scopeKey)
  );
  const [freeAdaptiveUsedCount, setFreeAdaptiveUsedCount] = useState<number>(() =>
    getFreeAdaptiveUsedCount(scopeKey)
  );

  useEffect(() => {
    setCustomPresets(loadCustomPresets(scopeKey));
    setFreeAdaptiveUsedCount(getFreeAdaptiveUsedCount(scopeKey));
  }, [scopeKey]);

  // Capture ?ref= on mount or hash change
  useEffect(() => {
    const syncRef = () => {
      const found = captureReferralFromCurrentUrl();
      if (found) setCapturedReferralCode(found);
    };
    syncRef();
    window.addEventListener('hashchange', syncRef);
    return () => window.removeEventListener('hashchange', syncRef);
  }, []);

  const isGoogleAdmin = Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  );

  const updateRoleSession = useCallback((next: RoleSession | null) => {
    setRoleSession(next);
    saveActiveChildSession(next);
  }, []);

  // 1. Public real-time Top Champions & AppGlobalConfig
  useEffect(() => {
    if (!isConfigured) {
      const localState = loadLocalGrowthState();
      setAppConfig(localState.appConfig);
      setAgents(localState.agents);
      setLeads(localState.leads);
      setStudentSubscriptions(localState.studentSubscriptions);
      setPayoutRequests(localState.payoutRequests);
      setVouchers(localState.vouchers);
      setTopChampions([]);
      setChildLeaderboard([]);
      setTopChampionsLoading(false);
      return;
    }

    setTopChampionsLoading(true);
    const unsubConfig = subscribeAppConfig(setAppConfig);
    const unsubTop3 = subscribeChildChampions(
      25,
      (items) => {
        const visible = items.filter((e) => !e.isHidden);
        setTopChampions(visible.slice(0, 3));
        setTopChampionsLoading(false);
        setTopChampionsError(null);
      },
      (err) => {
        setTopChampionsLoading(false);
        setTopChampionsError(err.message);
      }
    );

    const unsubAll = subscribeChildChampions(
      50,
      (items) => {
        setChildLeaderboard(items);
      },
      () => {
        // Surfaced via top3 listener
      }
    );

    return () => {
      unsubConfig();
      unsubTop3();
      unsubAll();
    };
  }, [isConfigured]);

  // 2. Real-time Cloud Firestore workspace listeners
  useEffect(() => {
    if (!authReady) return;
    if (!isConfigured) {
      setPlatformLoading(false);
      return;
    }
    if (!user) {
      setAgents([]);
      setParents([]);
      setChildren([]);
      setSubscriptions([]);
      setPracticeSessions([]);
      setLeads([]);
      setStudentSubscriptions([]);
      setPayoutRequests([]);
      setVouchers([]);
      setPlatformLoading(false);
      updateRoleSession(null);
      return;
    }

    setPlatformLoading(true);
    const unsub = subscribePlatformWorkspace(user, {
      onAgents: setAgents,
      onParents: setParents,
      onChildren: setChildren,
      onSubscriptions: setSubscriptions,
      onPracticeSessions: setPracticeSessions,
      onLeads: setLeads,
      onStudentSubscriptions: setStudentSubscriptions,
      onPayoutRequests: setPayoutRequests,
      onVouchers: setVouchers,
      onReady: () => setPlatformLoading(false),
      onError: (err) => {
        setPlatformError(err.message);
        setPlatformLoading(false);
      },
    });

    return () => unsub();
  }, [authReady, user, isConfigured, updateRoleSession]);

  const syncedPortalKeysRef = useRef<Set<string>>(new Set());

  // 3. Automatically resolve verified role from Firestore
  useEffect(() => {
    if (!authReady || !user || !isConfigured) return;

    let cancelled = false;
    void resolveUserRoleFromFirestore(user)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved.inactiveAgent) {
          setRoleResolveNotice(
            'Your Agent account is currently suspended by Admin.'
          );
          return;
        }
        if (resolved.session) {
          setRoleResolveNotice(null);
          setRoleSession((current) => {
            if (
              current?.role === 'child' &&
              resolved.session?.role === 'parent' &&
              current.returnToParentId === resolved.session.accountId
            ) {
              return current;
            }
            saveActiveChildSession(null);
            return resolved.session;
          });
          if (googleSignInSeq > 0) {
            setAutoRouteEvent({
              seq: googleSignInSeq,
              route: resolved.route,
            });
          }
        } else if (googleSignInSeq > 0) {
          setRoleResolveNotice(
            `Signed in as ${user.email}. No Admin, Agent, or Parent portal is linked to this email yet — you can practice freely on the Home screen or sign up as a Sales Partner.`
          );
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user, isConfigured, googleSignInSeq]);

  // 4. Background backfill of /portalLogin/{token} for loaded Agent & Parent profiles
  useEffect(() => {
    if (!isConfigured || !user || platformLoading) return;
    let cancelled = false;

    const runBackfill = async () => {
      for (const a of agents) {
        if (cancelled) return;
        const digits = normalizePhoneDigits(a.phone);
        if (digits.length < 7 || !a.password) continue;
        for (const pwd of buildPasswordCandidates(a.password)) {
          const cacheKey = `agent:${a.id}:${digits}:${pwd}`;
          if (syncedPortalKeysRef.current.has(cacheKey)) continue;
          syncedPortalKeysRef.current.add(cacheKey);
          await cloudSyncPortalLogin(user, {
            role: 'agent',
            accountId: a.id,
            phone: digits,
            password: pwd,
            displayName: a.name,
            legacyAuthEmail: a.email,
          }).catch(() => {});
        }
      }

      for (const p of parents) {
        if (cancelled) return;
        const digits = normalizePhoneDigits(p.contact);
        if (digits.length < 7 || !p.password) continue;
        for (const pwd of buildPasswordCandidates(p.password)) {
          const cacheKey = `parent:${p.id}:${digits}:${pwd}`;
          if (syncedPortalKeysRef.current.has(cacheKey)) continue;
          syncedPortalKeysRef.current.add(cacheKey);
          await cloudSyncPortalLogin(user, {
            role: 'parent',
            accountId: p.id,
            phone: digits,
            password: pwd,
            displayName: p.name,
            legacyAuthEmail: p.authEmail || buildParentAuthEmail(digits),
          }).catch(() => {});
        }
      }
    };

    void runBackfill();
    return () => {
      cancelled = true;
    };
  }, [agents, isConfigured, parents, platformLoading, user]);

  // Selectors
  const getAgentById = useCallback(
    (agentId: string) => agents.find((a) => a.id === agentId),
    [agents]
  );

  const getParentById = useCallback(
    (parentId: string) => parents.find((p) => p.id === parentId),
    [parents]
  );

  const getChildById = useCallback(
    (childId: string) => children.find((c) => c.id === childId),
    [children]
  );

  const getChildrenForParent = useCallback(
    (parentId: string) => children.filter((c) => c.parentId === parentId),
    [children]
  );

  const getSubscriptionHistoryForParent = useCallback(
    (parentId: string) =>
      subscriptions
        .filter((s) => s.parentId === parentId)
        .sort((a, b) => {
          if (b.expiryDate !== a.expiryDate) {
            return b.expiryDate.localeCompare(a.expiryDate);
          }
          return b.createdAtMs - a.createdAtMs;
        }),
    [subscriptions]
  );

  const getLatestSubscriptionForParent = useCallback(
    (parentId: string) => getSubscriptionHistoryForParent(parentId)[0],
    [getSubscriptionHistoryForParent]
  );

  // Active Pro Subscription calculation (covers direct student sub, parent family plan, or Admin)
  const myStudentSubscription = useMemo(() => {
    const emailLower = user?.email ? normalizeEmailForMatch(user.email) : '';
    return studentSubscriptions.find((sub) => {
      if (!isStudentSubscriptionActive(sub)) return false;
      if (!isConfigured) return true;
      if (!user) return false;
      return (
        sub.ownerUid === user.uid ||
        (emailLower && sub.subscriberEmail === emailLower)
      );
    });
  }, [isConfigured, studentSubscriptions, user]);

  const isProSubscriber = useMemo(() => {
    if (isGoogleAdmin) return true;
    if (myStudentSubscription) return true;
    if (roleSession?.role === 'child') {
      const ch = children.find((c) => c.id === roleSession.accountId);
      if (ch) {
        const sub = getLatestSubscriptionForParent(ch.parentId);
        if (evaluateSubscriptionState(sub).canPractice) return true;
      }
    }
    if (roleSession?.role === 'parent') {
      const sub = getLatestSubscriptionForParent(roleSession.accountId);
      if (evaluateSubscriptionState(sub).canPractice) return true;
    }
    return false;
  }, [
    children,
    getLatestSubscriptionForParent,
    isGoogleAdmin,
    myStudentSubscription,
    roleSession,
  ]);

  const getChildStats = useCallback(
    (childId: string): ChildStatsSummary => {
      const child = children.find((c) => c.id === childId);
      const childRuns = practiceSessions.filter((s) => s.childId === childId);
      if (childRuns.length === 0) {
        return {
          totalScore: child?.totalScore ?? 0,
          totalSessions: child?.sessionsCount ?? 0,
          totalAttempted: 0,
          totalCorrect: 0,
          accuracy: 0,
          bestStreak: child?.bestStreak ?? 0,
          avgResponseMs: 0,
          weakTopics: [],
          recentSessions: [],
        };
      }

      let totalAttempted = 0;
      let totalCorrect = 0;
      let bestStreak = child?.bestStreak ?? 0;
      let weightedMs = 0;
      const topicAccMap: Record<
        ConcreteOperation,
        { flagged: number; accSum: number; count: number }
      > = {
        addition: { flagged: 0, accSum: 0, count: 0 },
        subtraction: { flagged: 0, accSum: 0, count: 0 },
        multiplication: { flagged: 0, accSum: 0, count: 0 },
        division: { flagged: 0, accSum: 0, count: 0 },
      };

      for (const run of childRuns) {
        totalAttempted += run.attempted;
        totalCorrect += run.correct;
        if (run.bestStreak > bestStreak) bestStreak = run.bestStreak;
        weightedMs += run.avgResponseMs * run.attempted;

        if (run.weakTopic !== 'none') {
          topicAccMap[run.weakTopic].flagged += 1;
          topicAccMap[run.weakTopic].accSum += run.accuracy;
          topicAccMap[run.weakTopic].count += 1;
        } else if (run.mode !== 'mixed' && run.accuracy < 80) {
          topicAccMap[run.mode].flagged += 1;
          topicAccMap[run.mode].accSum += run.accuracy;
          topicAccMap[run.mode].count += 1;
        }
      }

      const weakTopics = (
        Object.keys(topicAccMap) as ConcreteOperation[]
      )
        .filter((t) => topicAccMap[t].flagged > 0)
        .map((topic) => ({
          topic,
          sessionsFlagged: topicAccMap[topic].flagged,
          avgAccuracy:
            topicAccMap[topic].count > 0
              ? Math.round(topicAccMap[topic].accSum / topicAccMap[topic].count)
              : 0,
        }))
        .sort((a, b) => b.sessionsFlagged - a.sessionsFlagged);

      return {
        totalScore: Math.max(child?.totalScore ?? 0, totalCorrect),
        totalSessions: Math.max(child?.sessionsCount ?? 0, childRuns.length),
        totalAttempted,
        totalCorrect,
        accuracy:
          totalAttempted > 0
            ? Math.round((totalCorrect / totalAttempted) * 1000) / 10
            : 0,
        bestStreak,
        avgResponseMs:
          totalAttempted > 0 ? Math.round(weightedMs / totalAttempted) : 0,
        weakTopics,
        recentSessions: childRuns.slice(0, 10),
      };
    },
    [children, practiceSessions]
  );

  // ---------------------------------------------------------------------------
  // Presets, Paywall & Referral Validation
  // ---------------------------------------------------------------------------

  const saveCustomPreset = useCallback(
    (name: string, cfg: DrillConfig) => {
      const cleanName = name.trim().slice(0, 32) || 'Custom Drill';
      const preset: CustomPreset = {
        id: makeId('preset'),
        name: cleanName,
        mode: cfg.mode,
        difficulty: cfg.difficulty,
        indianClass: cfg.indianClass,
        sessionType: cfg.sessionType,
        durationSec: cfg.durationSec,
        allowNegatives: cfg.allowNegatives,
        autoSubmit: cfg.autoSubmit,
        createdAtMs: Date.now(),
      };
      setCustomPresets(saveCustomPresetItem(scopeKey, preset));
    },
    [scopeKey]
  );

  const deleteCustomPreset = useCallback(
    (presetId: string) => {
      setCustomPresets(deleteCustomPresetItem(scopeKey, presetId));
    },
    [scopeKey]
  );

  const markFreeAdaptiveUsed = useCallback(() => {
    setFreeAdaptiveUsedCount(incrementFreeAdaptiveUsedCount(scopeKey));
  }, [scopeKey]);

  const openCheckoutModal = useCallback((tab: 'plan' | 'voucher' = 'plan') => {
    setCheckoutInitialTab(tab);
    setIsCheckoutOpen(true);
  }, []);

  const closeCheckoutModal = useCallback(() => {
    setIsCheckoutOpen(false);
  }, []);

  const validatePromoCode = useCallback(
    async (
      rawCode: string,
      buyerEmail?: string,
      buyerPhone?: string
    ): Promise<PromoValidationResult> => {
      const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
      if (code.length < 2) {
        return {
          valid: false,
          code,
          discountAmount: 0,
          agentId: '',
          agentName: '',
          isSelfReferral: false,
          message: 'Enter a valid referral or promo code.',
        };
      }

      let refDoc: ReferralCodePublic | null = null;
      if (isConfigured) {
        refDoc = await lookupReferralCodeCloud(code);
      } else {
        const localState = loadLocalGrowthState();
        refDoc = localState.referralCodes[code] ?? null;
      }

      // Also check already-loaded agents list in case offline or just created
      const localAgentMatch = agents.find(
        (a) => a.agentCode.toUpperCase() === code
      );
      if (!refDoc && localAgentMatch) {
        refDoc = {
          code,
          workspaceId: WORKSPACE_ID,
          agentId: localAgentMatch.id,
          agentName: localAgentMatch.name,
          isActive: localAgentMatch.isActive,
          approvalStatus: getAgentApprovalStatus(localAgentMatch),
          emailHash: await hashContactForAttribution(localAgentMatch.email),
          phoneHash: await hashContactForAttribution(localAgentMatch.phone),
          updatedAtMs: localAgentMatch.updatedAtMs,
        };
      }

      if (!refDoc) {
        return {
          valid: false,
          code,
          discountAmount: 0,
          agentId: '',
          agentName: '',
          isSelfReferral: false,
          message: `Promo code "${code}" was not found.`,
        };
      }

      if (!refDoc.isActive || refDoc.approvalStatus !== 'approved') {
        return {
          valid: false,
          code,
          discountAmount: 0,
          agentId: refDoc.agentId,
          agentName: refDoc.agentName,
          isSelfReferral: false,
          message: `Partner code "${code}" is currently pending Admin approval.`,
        };
      }

      // Self-referral check against buyer email/phone and current Firebase UID
      const normEmail = normalizeEmailForMatch(
        buyerEmail || user?.email || ''
      );
      const normPhone = normalizePhoneForMatch(buyerPhone || '');
      const [buyerEmailHash, buyerPhoneHash] = await Promise.all([
        hashContactForAttribution(normEmail),
        hashContactForAttribution(normPhone),
      ]);

      const sameUid = Boolean(
        user && localAgentMatch && localAgentMatch.ownerUid === user.uid
      );
      const sameEmail = Boolean(
        normEmail &&
          ((refDoc.emailHash && buyerEmailHash === refDoc.emailHash) ||
            (localAgentMatch &&
              normalizeEmailForMatch(localAgentMatch.email) === normEmail))
      );
      const samePhone = Boolean(
        normPhone &&
          ((refDoc.phoneHash && buyerPhoneHash === refDoc.phoneHash) ||
            (localAgentMatch &&
              normalizePhoneForMatch(localAgentMatch.phone) === normPhone))
      );

      if (sameUid || sameEmail || samePhone) {
        return {
          valid: false,
          code,
          discountAmount: 0,
          agentId: '',
          agentName: refDoc.agentName,
          isSelfReferral: true,
          message:
            'Self-referral detected: agents cannot apply their own promo code or earn commission on their own purchase.',
        };
      }

      return {
        valid: true,
        code: refDoc.code,
        discountAmount: REFERRAL_DISCOUNT_INR,
        agentId: refDoc.agentId,
        agentName: refDoc.agentName,
        agentEmail: localAgentMatch?.email,
        isSelfReferral: false,
        message: `₹${REFERRAL_DISCOUNT_INR} student discount applied via partner ${refDoc.agentName}.`,
      };
    },
    [agents, isConfigured, user]
  );

  const completeAnnualCheckout = useCallback(
    async (input: {
      subscriberName: string;
      subscriberEmail: string;
      subscriberPhone: string;
      paymentMethod: 'upi' | 'card';
      promoCode?: string;
    }) => {
      const nameClean = input.subscriberName.trim();
      const emailClean = normalizeEmailForMatch(
        input.subscriberEmail || user?.email || ''
      );
      const phoneClean = input.subscriberPhone.trim();

      if (!nameClean || !emailClean.includes('@')) {
        return {
          ok: false,
          error: 'Enter your name and a valid email address.',
        };
      }

      let promoResult: PromoValidationResult | null = null;
      if (input.promoCode?.trim()) {
        promoResult = await validatePromoCode(
          input.promoCode,
          emailClean,
          phoneClean
        );
        if (promoResult.isSelfReferral) {
          return { ok: false, error: promoResult.message };
        }
      }

      const discountApplied =
        promoResult && promoResult.valid ? promoResult.discountAmount : 0;
      const amountPaid = Math.max(0, ANNUAL_PLAN_PRICE_INR - discountApplied);
      const attributedAgentId =
        promoResult && promoResult.valid ? promoResult.agentId : '';
      const attributedAgent = attributedAgentId
        ? agents.find((a) => a.id === attributedAgentId)
        : undefined;
      const monthlyAgentConversions = attributedAgentId
        ? studentSubscriptions.filter(
            (s) =>
              s.attributedAgentId === attributedAgentId &&
              s.status === 'active' &&
              isSameCalendarMonth(s.createdAtMs)
          ).length +
          subscriptions.filter(
            (s) =>
              s.collectedByAgentId === attributedAgentId &&
              s.status === 'active' &&
              isSameCalendarMonth(s.createdAtMs)
          ).length
        : 0;
      const commissionAmount = attributedAgentId
        ? getCommissionForNextConversion(
            attributedAgent ?? { commissionPerConversion: 0 },
            monthlyAgentConversions
          )
        : 0;

      const today = todayIsoDate();
      const now = Date.now();
      const sub: StudentSubscription = {
        id: makeId('ss'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'local_user',
        subscriberName: nameClean,
        subscriberEmail: emailClean,
        subscriberPhone: phoneClean,
        planType: 'yearly',
        startDate: today,
        expiryDate: addOneYearIso(today),
        amountPaid,
        discountApplied,
        paymentMethod: input.paymentMethod,
        referralCode: promoResult && promoResult.valid ? promoResult.code : '',
        attributedAgentId,
        agentEmail: attributedAgent?.email || promoResult?.agentEmail || '',
        voucherCode: '',
        commissionAmount,
        status: 'active',
        createdAtMs: now,
        updatedAtMs: now,
      };

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.studentSubscriptions = [sub, ...local.studentSubscriptions];
        saveLocalGrowthState(local);
        setStudentSubscriptions(local.studentSubscriptions);
        return { ok: true, subscription: sub };
      }

      if (!user) {
        return {
          ok: false,
          error: 'Sign in with Google first to activate and sync your Pro plan.',
        };
      }

      try {
        await cloudCreateStudentSubscription(user, sub);
        // Mark any matching trial lead as converted
        const matchingLead = leads.find(
          (l) =>
            l.status === 'trial' &&
            (l.ownerUid === user.uid || (emailClean && l.email === emailClean))
        );
        if (matchingLead) {
          await cloudUpdateLeadStatus(matchingLead.id, 'converted').catch(
            () => {}
          );
        }
        if (promoResult?.valid) {
          saveStickyReferral(promoResult.code);
          setCapturedReferralCode(promoResult.code);
        }
        return { ok: true, subscription: sub };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    },
    [
      agents,
      isConfigured,
      leads,
      studentSubscriptions,
      subscriptions,
      user,
      validatePromoCode,
    ]
  );

  const redeemOfflineVoucher = useCallback(
    async (input: {
      voucherCode: string;
      subscriberName?: string;
      subscriberPhone?: string;
    }) => {
      const codeClean = input.voucherCode
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_\-]/g, '');
      if (codeClean.length < 4) {
        return { ok: false, error: 'Enter a valid activation voucher code.' };
      }

      const emailClean = normalizeEmailForMatch(user?.email || '');
      const nameClean = (
        input.subscriberName?.trim() ||
        user?.displayName ||
        emailClean.split('@')[0] ||
        'Student'
      ).slice(0, 80);

      let redeemedVoucher: OfflineVoucher;
      if (!isConfigured) {
        const local = loadLocalGrowthState();
        const found = local.vouchers.find((v) => v.code === codeClean);
        if (!found) {
          return { ok: false, error: 'Offline voucher code not found.' };
        }
        if (found.status === 'redeemed') {
          return {
            ok: false,
            error: 'This offline voucher code has already been redeemed.',
          };
        }
        found.status = 'redeemed';
        found.redeemedByUid = user?.uid || 'local_user';
        found.redeemedByEmail = emailClean;
        found.redeemedAt = todayIsoDate();
        saveLocalGrowthState(local);
        setVouchers([...local.vouchers]);
        redeemedVoucher = found;
      } else {
        if (!user) {
          return {
            ok: false,
            error: 'Sign in with Google first to redeem an activation voucher.',
          };
        }
        try {
          redeemedVoucher = await cloudLookupAndRedeemVoucher(user, codeClean);
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      // Check self-referral guard if voucher is attributed to an agent
      const attrAgentId = redeemedVoucher.agentId;
      const isSelfVoucher = Boolean(
        attrAgentId &&
          ((user && redeemedVoucher.agentEmail === emailClean && emailClean) ||
            (agents.find((a) => a.id === attrAgentId)?.ownerUid === user?.uid))
      );

      const effectiveAgentId = isSelfVoucher ? '' : attrAgentId;
      const attrAgent = effectiveAgentId
        ? agents.find((a) => a.id === effectiveAgentId)
        : undefined;
      const monthlyAttrConversions = effectiveAgentId
        ? studentSubscriptions.filter(
            (s) =>
              s.attributedAgentId === effectiveAgentId &&
              s.status === 'active' &&
              isSameCalendarMonth(s.createdAtMs)
          ).length +
          subscriptions.filter(
            (s) =>
              s.collectedByAgentId === effectiveAgentId &&
              s.status === 'active' &&
              isSameCalendarMonth(s.createdAtMs)
          ).length
        : 0;
      const commissionAmount = effectiveAgentId
        ? getCommissionForNextConversion(
            attrAgent ?? { commissionPerConversion: 0 },
            monthlyAttrConversions
          )
        : 0;

      const today = todayIsoDate();
      const now = Date.now();
      const sub: StudentSubscription = {
        id: makeId('ss'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'local_user',
        subscriberName: nameClean,
        subscriberEmail: emailClean,
        subscriberPhone: input.subscriberPhone?.trim() || '',
        planType: 'yearly',
        startDate: today,
        expiryDate: addOneYearIso(today),
        amountPaid: redeemedVoucher.planAmount || ANNUAL_PLAN_PRICE_INR,
        discountApplied: 0,
        paymentMethod: 'voucher',
        referralCode: attrAgent?.agentCode || '',
        attributedAgentId: effectiveAgentId,
        agentEmail: isSelfVoucher ? '' : redeemedVoucher.agentEmail,
        voucherCode: redeemedVoucher.code,
        commissionAmount,
        status: 'active',
        createdAtMs: now,
        updatedAtMs: now,
      };

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.studentSubscriptions = [sub, ...local.studentSubscriptions];
        saveLocalGrowthState(local);
        setStudentSubscriptions(local.studentSubscriptions);
        return { ok: true, subscription: sub };
      }

      if (!user) {
        return { ok: false, error: 'Sign in required.' };
      }
      try {
        await cloudCreateStudentSubscription(user, sub);
        return { ok: true, subscription: sub };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [agents, isConfigured, studentSubscriptions, subscriptions, user]
  );

  const recordTrialLeadIfReferred = useCallback(
    async (name: string, email: string, phone = '') => {
      if (!capturedReferralCode || !user) return;
      if (isPhoneAuthEmail(user.email)) return;
      const emailLower = normalizeEmailForMatch(email || user.email || '');
      if (!emailLower) return;

      const alreadyLogged = leads.some(
        (l) =>
          (l.ownerUid === user.uid || l.email === emailLower) &&
          l.referralCode === capturedReferralCode
      );
      if (alreadyLogged) return;

      const validation = await validatePromoCode(
        capturedReferralCode,
        emailLower,
        phone
      );
      if (!validation.valid || validation.isSelfReferral || !validation.agentId) {
        return;
      }

      const now = Date.now();
      const lead: TrialLead = {
        id: makeId('lead'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        name: name.trim() || emailLower.split('@')[0] || 'Student',
        email: emailLower,
        phone: phone.trim(),
        referralCode: validation.code,
        agentId: validation.agentId,
        agentEmail: validation.agentEmail || '',
        status: isProSubscriber ? 'converted' : 'trial',
        createdAtMs: now,
        updatedAtMs: now,
      };

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.leads = [lead, ...local.leads];
        saveLocalGrowthState(local);
        setLeads(local.leads);
        return;
      }

      await cloudCreateTrialLead(user, lead).catch(() => {});
    },
    [
      capturedReferralCode,
      isConfigured,
      isProSubscriber,
      leads,
      user,
      validatePromoCode,
    ]
  );

  // ---------------------------------------------------------------------------
  // Authentication & Sales Agent Onboarding
  // ---------------------------------------------------------------------------

  const signInAndRouteWithGoogle = useCallback(async () => {
    if (!isConfigured) {
      return { ok: false, error: 'Firebase is not configured.' };
    }
    setRoleResolveNotice(null);
    if (user) {
      const resolved = await resolveUserRoleFromFirestore(user);
      if (resolved.inactiveAgent) {
        return {
          ok: false,
          error: 'Your Agent account has been suspended by Admin.',
        };
      }
      if (resolved.session) {
        updateRoleSession(resolved.session);
        setAutoRouteEvent({ seq: Date.now(), route: resolved.route });
        return { ok: true };
      }
      return {
        ok: false,
        error: `Signed in as ${user.email}, but no Admin, Agent, or Parent account is linked to this email yet.`,
      };
    }
    await signInWithGoogle();
    return { ok: true };
  }, [isConfigured, signInWithGoogle, updateRoleSession, user]);

  const signInWithGoogleRedirectFlow = useCallback(async () => {
    setRoleResolveNotice(null);
    await signInWithGoogleRedirect();
  }, [signInWithGoogleRedirect]);

  const registerSalesAgent = useCallback(
    async (input: {
      name: string;
      phone: string;
      password: string;
      city: string;
      upiId: string;
      agentCode?: string;
    }) => {
      const nameClean = input.name.trim();
      const phoneDigits = normalizePhoneDigits(input.phone);
      const passwordClean = input.password.trim();
      const cityClean = input.city.trim();
      const upiClean = input.upiId.trim();

      if (!nameClean || !cityClean || !upiClean) {
        return {
          ok: false,
          error: 'Name, Phone, City, and UPI ID are all required.',
        };
      }
      if (phoneDigits.length < 7) {
        return {
          ok: false,
          error: 'Enter a valid mobile phone number (at least 7 digits).',
        };
      }
      if (passwordClean.length < 4) {
        return {
          ok: false,
          error: 'Password must be at least 4 characters long.',
        };
      }
      if (!upiClean.includes('@')) {
        return {
          ok: false,
          error: 'Enter a valid UPI ID (e.g. name@okaxis or mobile@ybl).',
        };
      }

      const authEmail = buildAgentAuthEmail(phoneDigits);
      const duplicateLocal = agents.find(
        (a) =>
          normalizePhoneDigits(a.phone) === phoneDigits ||
          a.email.toLowerCase() === authEmail
      );
      if (duplicateLocal) {
        return {
          ok: false,
          error:
            'An Agent profile with this phone number already exists. Sign in with your phone number and password.',
        };
      }

      const baseSlug = nameClean
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4)
        .padEnd(2, 'A');
      const generatedCode =
        input.agentCode
          ?.trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_\-]/g, '')
          .slice(0, 12) ||
        `${baseSlug}${Math.floor(100 + Math.random() * 900)}`;

      const now = Date.now();
      const passcodeHash = await hashSecret(passwordClean);

      if (!isConfigured) {
        const newAgent: AgentProfile = {
          id: makeId('ag'),
          workspaceId: WORKSPACE_ID,
          ownerUid: `local_${phoneDigits}`,
          agentCode: generatedCode,
          name: nameClean,
          phone: phoneDigits,
          email: authEmail,
          assignedArea: cityClean,
          city: cityClean,
          upiId: upiClean,
          approvalStatus: 'pending',
          commissionRate: 0,
          commissionPerConversion: 0,
          defaultYearlyFee: ANNUAL_PLAN_PRICE_INR,
          passcodeHash,
          password: passwordClean,
          isActive: false,
          createdAtMs: now,
          updatedAtMs: now,
        };
        const local = loadLocalGrowthState();
        local.agents = [newAgent, ...local.agents];
        saveLocalGrowthState(local);
        setAgents(local.agents);
        updateRoleSession({
          role: 'agent',
          accountId: newAgent.id,
          displayName: newAgent.name,
        });
        return { ok: true, agent: newAgent };
      }

      const token = await buildPortalLoginToken('agent', phoneDigits, passwordClean);
      const versionedEmail = buildVersionedPhoneAuthEmail(
        'agent',
        phoneDigits,
        token
      );
      const existingTokenRecord = await cloudLookupPortalLogin(token);
      if (existingTokenRecord) {
        return {
          ok: false,
          error:
            'An Agent profile with this phone number already exists. Sign in with your phone number and password.',
        };
      }

      const signupOutcome = await signInOrProvisionTokenAccount(
        versionedEmail,
        token.slice(0, 24),
        nameClean
      );
      if (!signupOutcome.user) {
        return {
          ok: false,
          error:
            signupOutcome.error ||
            'Could not register phone number and password.',
        };
      }

      const alreadyRegistered = await resolveUserRoleFromFirestore(
        signupOutcome.user,
        { expectedRole: 'agent', phoneDigits }
      );
      if (alreadyRegistered.agentDoc) {
        await signOutUser();
        return {
          ok: false,
          error:
            'An Agent profile with this phone number already exists. Sign in with your phone number and password.',
        };
      }

      const newAgent: AgentProfile = {
        id: makeId('ag'),
        workspaceId: WORKSPACE_ID,
        ownerUid: signupOutcome.user.uid,
        agentCode: generatedCode,
        name: nameClean,
        phone: phoneDigits,
        email: authEmail,
        assignedArea: cityClean,
        city: cityClean,
        upiId: upiClean,
        approvalStatus: 'pending',
        commissionRate: 0,
        commissionPerConversion: 0,
        defaultYearlyFee: ANNUAL_PLAN_PRICE_INR,
        passcodeHash,
        password: passwordClean,
        isActive: false,
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateAgent(signupOutcome.user, newAgent);
        await cloudSyncPortalLogin(signupOutcome.user, {
          role: 'agent',
          accountId: newAgent.id,
          phone: phoneDigits,
          password: passwordClean,
          displayName: nameClean,
          legacyAuthEmail: authEmail,
        }).catch(() => {});
        setAgents((prev) =>
          prev.some((a) => a.id === newAgent.id) ? prev : [newAgent, ...prev]
        );
        updateRoleSession({
          role: 'agent',
          accountId: newAgent.id,
          displayName: newAgent.name,
        });
        return { ok: true, agent: newAgent };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [
      agents,
      isConfigured,
      signInOrProvisionTokenAccount,
      signOutUser,
      updateRoleSession,
    ]
  );

  const updateAgentSelfProfile = useCallback(
    async (
      agentId: string,
      patch: { name: string; phone: string; city: string; upiId: string }
    ) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return { ok: false, error: 'Agent profile not found.' };
      if (!patch.upiId.trim().includes('@')) {
        return { ok: false, error: 'Enter a valid UPI ID containing "@".' };
      }

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.agents = local.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                name: patch.name.trim() || a.name,
                phone: patch.phone.trim() || a.phone,
                city: patch.city.trim() || a.city,
                assignedArea: patch.city.trim() || a.assignedArea,
                upiId: patch.upiId.trim(),
                updatedAtMs: Date.now(),
              }
            : a
        );
        saveLocalGrowthState(local);
        setAgents(local.agents);
        return { ok: true };
      }

      try {
        await cloudUpdateAgentSelfProfile(target, patch);
        if (user && target.password) {
          const nextPhoneDigits =
            normalizePhoneDigits(patch.phone) || normalizePhoneDigits(target.phone);
          const prevPhoneDigits = normalizePhoneDigits(target.phone);
          if (prevPhoneDigits && prevPhoneDigits !== nextPhoneDigits) {
            await cloudDeletePortalLogin('agent', prevPhoneDigits, target.password);
          }
          if (nextPhoneDigits.length >= 7) {
            await cloudSyncPortalLogin(user, {
              role: 'agent',
              accountId: target.id,
              phone: nextPhoneDigits,
              password: target.password,
              displayName: patch.name.trim() || target.name,
              legacyAuthEmail: target.email,
            }).catch(() => {});
          }
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [agents, isConfigured, user]
  );

  const changeAgentPassword = useCallback(
    async (agentId: string, newPassword: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return { ok: false, error: 'Agent profile not found.' };
      const nextPwd = newPassword.trim();
      if (nextPwd.length < 4) {
        return {
          ok: false,
          error: 'New password must be at least 4 characters long.',
        };
      }

      const nextHash = await hashSecret(nextPwd);
      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.agents = local.agents.map((a) =>
          a.id === agentId
            ? {
                ...a,
                password: nextPwd,
                passcodeHash: nextHash,
                updatedAtMs: Date.now(),
              }
            : a
        );
        saveLocalGrowthState(local);
        setAgents(local.agents);
        return { ok: true };
      }

      try {
        await cloudUpdateAgentPassword(agentId, nextPwd, nextHash);

        const phoneDigits = normalizePhoneDigits(target.phone);
        if (target.password && target.password !== nextPwd && phoneDigits.length >= 7) {
          await cloudDeletePortalLogin('agent', phoneDigits, target.password);
        }

        if (user && phoneDigits.length >= 7) {
          const newToken = await cloudSyncPortalLogin(user, {
            role: 'agent',
            accountId: target.id,
            phone: phoneDigits,
            password: nextPwd,
            displayName: target.name,
            legacyAuthEmail: target.email,
          }).catch(() => '');

          if (isPhoneAgentAuthEmail(user.email)) {
            if (nextPwd.length >= 6 && user.email?.toLowerCase() === buildAgentAuthEmail(phoneDigits)) {
              await changeCurrentPassword(nextPwd).catch(() => {});
            } else if (newToken) {
              const versionedEmail = buildVersionedPhoneAuthEmail(
                'agent',
                phoneDigits,
                newToken
              );
              await signInOrProvisionTokenAccount(
                versionedEmail,
                newToken.slice(0, 24),
                target.name
              ).catch(() => {});
            }
          }
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [
      agents,
      changeCurrentPassword,
      isConfigured,
      signInOrProvisionTokenAccount,
      user,
    ]
  );

  const changeParentPassword = useCallback(
    async (parentId: string, newPassword: string) => {
      const target = parents.find((p) => p.id === parentId);
      if (!target) return { ok: false, error: 'Parent profile not found.' };
      const nextPwd = newPassword.trim();
      if (nextPwd.length < 4) {
        return {
          ok: false,
          error: 'New password must be at least 4 characters long.',
        };
      }

      const nextHash = await hashSecret(nextPwd);
      if (!isConfigured) {
        setParents((prev) =>
          prev.map((p) =>
            p.id === parentId
              ? {
                  ...p,
                  password: nextPwd,
                  passcodeHash: nextHash,
                  updatedAtMs: Date.now(),
                }
              : p
          )
        );
        return { ok: true };
      }

      try {
        await cloudUpdateParentPassword(parentId, nextPwd, nextHash);

        const phoneDigits = normalizePhoneDigits(target.contact);
        if (target.password && target.password !== nextPwd && phoneDigits.length >= 7) {
          await cloudDeletePortalLogin('parent', phoneDigits, target.password);
        }

        if (user && phoneDigits.length >= 7) {
          const newToken = await cloudSyncPortalLogin(user, {
            role: 'parent',
            accountId: target.id,
            phone: phoneDigits,
            password: nextPwd,
            displayName: target.name,
            legacyAuthEmail: target.authEmail || buildParentAuthEmail(phoneDigits),
          }).catch(() => '');

          if (isPhoneParentAuthEmail(user.email)) {
            if (nextPwd.length >= 6 && user.email?.toLowerCase() === buildParentAuthEmail(phoneDigits)) {
              await changeCurrentPassword(nextPwd).catch(() => {});
            } else if (newToken) {
              const versionedEmail = buildVersionedPhoneAuthEmail(
                'parent',
                phoneDigits,
                newToken
              );
              await signInOrProvisionTokenAccount(
                versionedEmail,
                newToken.slice(0, 24),
                target.name
              ).catch(() => {});
            }
          }
        }
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [
      changeCurrentPassword,
      isConfigured,
      parents,
      signInOrProvisionTokenAccount,
      user,
    ]
  );

  const requestAgentPayout = useCallback(
    async (agentId: string, amount: number, upiId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return { ok: false, error: 'Agent profile not found.' };
      if (getAgentApprovalStatus(agent) !== 'approved' || !agent.isActive) {
        return {
          ok: false,
          error: 'Your Agent account must be approved by Admin before requesting a payout.',
        };
      }
      const cleanUpi = upiId.trim();
      if (!cleanUpi.includes('@')) {
        return { ok: false, error: 'Enter a valid UPI ID before withdrawing.' };
      }
      const roundedAmount = Math.round(amount);
      if (roundedAmount < PAYOUT_MINIMUM_INR) {
        return {
          ok: false,
          error: `Minimum payout threshold is ₹${PAYOUT_MINIMUM_INR}.`,
        };
      }

      const ledger = computeAgentCommissionSummary(
        agent,
        studentSubscriptions,
        subscriptions,
        payoutRequests
      );
      if (roundedAmount > ledger.availableBalance) {
        return {
          ok: false,
          error: `Requested ₹${roundedAmount} exceeds available balance (₹${ledger.availableBalance}).`,
        };
      }

      const now = Date.now();
      const reqDoc: PayoutRequest = {
        id: makeId('pay'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || agent.ownerUid,
        agentId: agent.id,
        agentEmail: agent.email,
        agentName: agent.name,
        upiId: cleanUpi,
        amount: roundedAmount,
        status: 'pending',
        utrNumber: '',
        createdAtMs: now,
        updatedAtMs: now,
        paidAt: '',
      };

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.payoutRequests = [reqDoc, ...local.payoutRequests];
        saveLocalGrowthState(local);
        setPayoutRequests(local.payoutRequests);
        return { ok: true };
      }

      if (!user) {
        return { ok: false, error: 'Sign in first to request a payout.' };
      }
      try {
        await cloudCreatePayoutRequest(user, reqDoc);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [agents, isConfigured, payoutRequests, studentSubscriptions, subscriptions, user]
  );

  const loginAgentPhonePassword = useCallback(
    async (phone: string, password: string) => {
      const phoneDigits = normalizePhoneDigits(phone);
      const candidates = buildPasswordCandidates(password);
      if (phoneDigits.length < 7 || candidates.length === 0) {
        return {
          ok: false,
          error: 'Enter your registered phone number and password.',
        };
      }

      if (!isConfigured) {
        const match = agents.find(
          (a) => normalizePhoneDigits(a.phone) === phoneDigits
        );
        if (!match) {
          return {
            ok: false,
            error: 'No Agent account found for this phone number.',
          };
        }
        if (getAgentApprovalStatus(match) === 'suspended') {
          return {
            ok: false,
            error: 'This Agent account has been suspended by Admin.',
          };
        }
        const valid = await verifyDocPassword(match, candidates);
        if (!valid) {
          return {
            ok: false,
            error: 'Incorrect mobile number or password. Please check and try again.',
          };
        }
        updateRoleSession({
          role: 'agent',
          accountId: match.id,
          displayName: match.name,
        });
        return { ok: true };
      }

      let nonCredentialError: string | null = null;

      // 1. Primary path: /portalLogin/{token} bridge -> versioned Firebase token session -> live Firestore password verify
      for (const cand of candidates) {
        const token = await buildPortalLoginToken('agent', phoneDigits, cand);
        const portalRecord = await cloudLookupPortalLogin(token);
        if (!portalRecord || portalRecord.role !== 'agent') continue;

        const tokenAuth = await signInOrProvisionTokenAccount(
          portalRecord.authEmail,
          token.slice(0, 24),
          portalRecord.displayName || 'Agent'
        );
        if (!tokenAuth.user) {
          if (
            tokenAuth.code === 'auth/network-request-failed' ||
            tokenAuth.code === 'auth/operation-not-allowed' ||
            tokenAuth.code === 'auth/too-many-requests'
          ) {
            nonCredentialError = tokenAuth.error ?? nonCredentialError;
          }
          continue;
        }

        const resolved = await resolveUserRoleFromFirestore(tokenAuth.user, {
          expectedRole: 'agent',
          preferredAccountId: portalRecord.accountId,
          phoneDigits,
        });
        if (resolved.inactiveAgent) {
          await signOutUser();
          return {
            ok: false,
            error: 'Your Agent account has been suspended by Admin.',
          };
        }
        if (resolved.agentDoc) {
          const stillValid = await verifyDocPassword(resolved.agentDoc, [cand]);
          if (!stillValid) {
            await signOutUser();
            continue;
          }
        }
        if (resolved.session && resolved.session.role === 'agent') {
          updateRoleSession(resolved.session);
          return { ok: true };
        }
        await signOutUser();
      }

      // 2. Secondary path: Legacy Firebase Email/Password auth (`agent.<digits>@gmaths.local`)
      for (const cand of candidates) {
        if (cand.length < 4) continue;
        const authOutcome = await signInWithPhoneCredentials(
          phoneDigits,
          cand,
          'agent'
        );
        if (authOutcome.user) {
          const resolved = await resolveUserRoleFromFirestore(authOutcome.user, {
            expectedRole: 'agent',
            phoneDigits,
          });
          if (resolved.inactiveAgent) {
            await signOutUser();
            return {
              ok: false,
              error: 'Your Agent account has been suspended by Admin.',
            };
          }
          if (resolved.agentDoc) {
            const matchesLive = await verifyDocPassword(resolved.agentDoc, [cand]);
            if (!matchesLive) {
              await signOutUser();
              continue;
            }
          }
          if (resolved.session && resolved.session.role === 'agent') {
            await cloudSyncPortalLogin(authOutcome.user, {
              role: 'agent',
              accountId: resolved.session.accountId,
              phone: phoneDigits,
              password: cand,
              displayName: resolved.session.displayName,
              legacyAuthEmail: resolved.agentDoc?.email,
            }).catch(() => {});
            updateRoleSession(resolved.session);
            return { ok: true };
          }
          await signOutUser();
          return {
            ok: false,
            error:
              'Login verified, but your Agent workspace record was not found. Ask Admin to verify your Agent profile.',
          };
        }
        if (
          authOutcome.code === 'auth/network-request-failed' ||
          authOutcome.code === 'auth/operation-not-allowed' ||
          authOutcome.code === 'auth/too-many-requests'
        ) {
          nonCredentialError = authOutcome.error ?? nonCredentialError;
        }
      }

      // 3. Fallback if already signed in to Firebase (search ALL loaded agents, including synthetic-email agents)
      if (user) {
        const loadedMatch = agents.find(
          (a) => normalizePhoneDigits(a.phone) === phoneDigits
        );
        if (loadedMatch) {
          if (getAgentApprovalStatus(loadedMatch) === 'suspended') {
            return {
              ok: false,
              error: 'Your Agent account has been suspended by Admin.',
            };
          }
          const valid = await verifyDocPassword(loadedMatch, candidates);
          if (valid) {
            await cloudSyncPortalLogin(user, {
              role: 'agent',
              accountId: loadedMatch.id,
              phone: phoneDigits,
              password: loadedMatch.password || candidates[0],
              displayName: loadedMatch.name,
              legacyAuthEmail: loadedMatch.email,
            }).catch(() => {});
            updateRoleSession({
              role: 'agent',
              accountId: loadedMatch.id,
              displayName: loadedMatch.name,
            });
            return { ok: true };
          }
        }
      }

      return {
        ok: false,
        error:
          nonCredentialError ||
          'Incorrect mobile number or password. Please check and try again.',
      };
    },
    [
      agents,
      isConfigured,
      signInOrProvisionTokenAccount,
      signInWithPhoneCredentials,
      signOutUser,
      updateRoleSession,
      user,
    ]
  );

  const loginAgentPasscode = useCallback(
    async (identifier: string, passcode: string) => {
      if (!user) {
        return loginAgentPhonePassword(identifier, passcode);
      }
      const idTrim = identifier.trim().toLowerCase();
      const idDigits = normalizePhoneDigits(identifier);
      const candidates = buildPasswordCandidates(passcode);
      if (!idTrim || candidates.length === 0) {
        return {
          ok: false,
          error: 'Enter your phone number or Agent ID and password.',
        };
      }
      const match = agents.find(
        (a) =>
          a.agentCode.toLowerCase() === idTrim ||
          a.phone.toLowerCase() === idTrim ||
          (idDigits.length >= 7 && normalizePhoneDigits(a.phone) === idDigits) ||
          a.email.toLowerCase() === idTrim
      );
      if (!match) {
        return loginAgentPhonePassword(identifier, passcode);
      }
      if (getAgentApprovalStatus(match) === 'suspended') {
        return {
          ok: false,
          error: 'This Agent account has been suspended by Admin.',
        };
      }
      const valid = await verifyDocPassword(match, candidates);
      if (!valid) {
        return {
          ok: false,
          error: 'Incorrect mobile number or password. Please check and try again.',
        };
      }
      updateRoleSession({
        role: 'agent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [agents, loginAgentPhonePassword, updateRoleSession, user]
  );

  const loginParentPhonePassword = useCallback(
    async (phone: string, password: string) => {
      const phoneDigits = normalizePhoneDigits(phone);
      const candidates = buildPasswordCandidates(password);
      if (phoneDigits.length < 7 || candidates.length === 0) {
        return {
          ok: false,
          error: 'Enter your registered mobile number and password.',
        };
      }

      if (!isConfigured) {
        const match = parents.find(
          (p) => normalizePhoneDigits(p.contact) === phoneDigits
        );
        if (!match) {
          return {
            ok: false,
            error: 'No Parent account found for this mobile number.',
          };
        }
        const valid = await verifyDocPassword(match, candidates);
        if (!valid) {
          return {
            ok: false,
            error: 'Incorrect mobile number or password. Please check and try again.',
          };
        }
        updateRoleSession({
          role: 'parent',
          accountId: match.id,
          displayName: match.name,
        });
        return { ok: true };
      }

      let nonCredentialError: string | null = null;

      // 1. Primary path: /portalLogin/{token} bridge -> versioned Firebase token session -> live Firestore password verify
      for (const cand of candidates) {
        const token = await buildPortalLoginToken('parent', phoneDigits, cand);
        const portalRecord = await cloudLookupPortalLogin(token);
        if (!portalRecord || portalRecord.role !== 'parent') continue;

        const tokenAuth = await signInOrProvisionTokenAccount(
          portalRecord.authEmail,
          token.slice(0, 24),
          portalRecord.displayName || 'Parent'
        );
        if (!tokenAuth.user) {
          if (
            tokenAuth.code === 'auth/network-request-failed' ||
            tokenAuth.code === 'auth/operation-not-allowed' ||
            tokenAuth.code === 'auth/too-many-requests'
          ) {
            nonCredentialError = tokenAuth.error ?? nonCredentialError;
          }
          continue;
        }

        const resolved = await resolveUserRoleFromFirestore(tokenAuth.user, {
          expectedRole: 'parent',
          preferredAccountId: portalRecord.accountId,
          phoneDigits,
        });
        if (resolved.parentDoc) {
          const stillValid = await verifyDocPassword(resolved.parentDoc, [cand]);
          if (!stillValid) {
            await signOutUser();
            continue;
          }
        }
        if (resolved.session && resolved.session.role === 'parent') {
          updateRoleSession(resolved.session);
          return { ok: true };
        }
        await signOutUser();
      }

      // 2. Secondary path: Legacy Firebase Email/Password auth (`parent.<digits>@gmaths.local`)
      for (const cand of candidates) {
        if (cand.length < 4) continue;
        const authOutcome = await signInWithPhoneCredentials(
          phoneDigits,
          cand,
          'parent'
        );
        if (authOutcome.user) {
          const resolved = await resolveUserRoleFromFirestore(authOutcome.user, {
            expectedRole: 'parent',
            phoneDigits,
          });
          if (resolved.parentDoc) {
            const matchesLive = await verifyDocPassword(resolved.parentDoc, [cand]);
            if (!matchesLive) {
              await signOutUser();
              continue;
            }
          }
          if (resolved.session && resolved.session.role === 'parent') {
            await cloudSyncPortalLogin(authOutcome.user, {
              role: 'parent',
              accountId: resolved.session.accountId,
              phone: phoneDigits,
              password: cand,
              displayName: resolved.session.displayName,
              legacyAuthEmail:
                resolved.parentDoc?.authEmail || buildParentAuthEmail(phoneDigits),
            }).catch(() => {});
            updateRoleSession(resolved.session);
            return { ok: true };
          }
          await signOutUser();
          return {
            ok: false,
            error:
              'Login verified, but your Parent workspace record was not found. Ask your Agent to check your family account.',
          };
        }
        if (
          authOutcome.code === 'auth/network-request-failed' ||
          authOutcome.code === 'auth/operation-not-allowed' ||
          authOutcome.code === 'auth/too-many-requests'
        ) {
          nonCredentialError = authOutcome.error ?? nonCredentialError;
        }
      }

      // 3. Fallback when already signed in to Firebase and parent doc is loaded
      if (user) {
        const legacyMatch = parents.find(
          (p) => normalizePhoneDigits(p.contact) === phoneDigits
        );
        if (legacyMatch) {
          const valid = await verifyDocPassword(legacyMatch, candidates);
          if (valid) {
            await cloudSyncPortalLogin(user, {
              role: 'parent',
              accountId: legacyMatch.id,
              phone: phoneDigits,
              password: legacyMatch.password || candidates[0],
              displayName: legacyMatch.name,
              legacyAuthEmail:
                legacyMatch.authEmail || buildParentAuthEmail(phoneDigits),
            }).catch(() => {});
            updateRoleSession({
              role: 'parent',
              accountId: legacyMatch.id,
              displayName: legacyMatch.name,
            });
            return { ok: true };
          }
        }
      }

      return {
        ok: false,
        error:
          nonCredentialError ||
          'Incorrect mobile number or password. Please check and try again.',
      };
    },
    [
      isConfigured,
      parents,
      signInOrProvisionTokenAccount,
      signInWithPhoneCredentials,
      signOutUser,
      updateRoleSession,
      user,
    ]
  );

  const loginParentPasscode = useCallback(
    async (contact: string, passcode: string) => {
      if (!user) {
        return loginParentPhonePassword(contact, passcode);
      }
      const target = contact.trim().toLowerCase();
      const targetDigits = normalizePhoneDigits(contact);
      const candidates = buildPasswordCandidates(passcode);
      if (!target || candidates.length === 0) {
        return {
          ok: false,
          error: 'Enter your registered mobile or email and password.',
        };
      }
      const match = parents.find(
        (p) =>
          p.contact.trim().toLowerCase() === target ||
          (targetDigits.length >= 7 &&
            normalizePhoneDigits(p.contact) === targetDigits) ||
          p.email.trim().toLowerCase() === target ||
          (p.authEmail && p.authEmail.trim().toLowerCase() === target)
      );
      if (!match) {
        return loginParentPhonePassword(contact, passcode);
      }
      const valid = await verifyDocPassword(match, candidates);
      if (!valid) {
        return {
          ok: false,
          error: 'Incorrect mobile number or password. Please check and try again.',
        };
      }
      updateRoleSession({
        role: 'parent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [loginParentPhonePassword, parents, updateRoleSession, user]
  );

  const switchToChildMode = useCallback(
    (childId: string) => {
      const child = children.find((c) => c.id === childId);
      if (!child) {
        return { ok: false, error: 'Child profile not found.' };
      }
      const latestSub = getLatestSubscriptionForParent(child.parentId);
      const subEval = evaluateSubscriptionState(latestSub);
      if (!subEval.canPractice) {
        return {
          ok: false,
          error:
            'Your yearly subscription is currently inactive or expired. Please contact your Agent to renew.',
        };
      }
      updateRoleSession({
        role: 'child',
        accountId: child.id,
        displayName: child.name,
        returnToParentId: child.parentId,
      });
      return { ok: true, child };
    },
    [children, getLatestSubscriptionForParent, updateRoleSession]
  );

  const exitChildModeToParent = useCallback(() => {
    if (roleSession?.role === 'child' && roleSession.returnToParentId) {
      const parent = parents.find((p) => p.id === roleSession.returnToParentId);
      if (parent) {
        updateRoleSession({
          role: 'parent',
          accountId: parent.id,
          displayName: parent.name,
        });
        return;
      }
    }
    updateRoleSession(null);
  }, [parents, roleSession, updateRoleSession]);

  const logoutRole = useCallback(async () => {
    updateRoleSession(null);
    setRoleResolveNotice(null);
    await signOutUser();
  }, [signOutUser, updateRoleSession]);

  // ---------------------------------------------------------------------------
  // Admin Operations
  // ---------------------------------------------------------------------------

  const createAgent = useCallback(
    async (input: {
      agentCode: string;
      name: string;
      phone: string;
      email: string;
      assignedArea: string;
      city?: string;
      upiId?: string;
      commissionRate: number;
      commissionPerConversion?: number;
      defaultYearlyFee: number;
      passcode: string;
    }) => {
      if (!user || !isConfigured) {
        return {
          ok: false,
          error: 'Sign in with Google Admin to save Agents to Cloud Firestore.',
        };
      }
      const codeClean = input.agentCode.trim().toUpperCase();
      const phoneDigits = normalizePhoneDigits(input.phone);
      const passwordClean = input.passcode.trim();
      if (!codeClean || !input.name.trim() || phoneDigits.length < 7) {
        return {
          ok: false,
          error:
            'Agent Name, Agent ID, and a valid Phone Number (at least 7 digits) are required.',
        };
      }
      if (passwordClean.length < 4) {
        return {
          ok: false,
          error: 'Agent Password must be at least 4 characters long.',
        };
      }

      const authEmail = buildAgentAuthEmail(phoneDigits);
      const duplicate = agents.some(
        (a) =>
          a.agentCode.toLowerCase() === codeClean.toLowerCase() ||
          normalizePhoneDigits(a.phone) === phoneDigits ||
          a.email.toLowerCase() === authEmail
      );
      if (duplicate) {
        return {
          ok: false,
          error: `An Agent with ID "${codeClean}" or phone "${phoneDigits}" already exists.`,
        };
      }

      let provisionedUid: string | null = null;
      if (passwordClean.length >= 6) {
        try {
          provisionedUid = await provisionAgentAuthAccount(
            authEmail,
            passwordClean
          );
        } catch {
          // Non-fatal: /portalLogin bridge provides seamless login regardless of legacy auth collisions
        }
      }

      const now = Date.now();
      const passcodeHash = await hashSecret(passwordClean);
      const areaClean = input.assignedArea.trim() || input.city?.trim() || 'General';
      const newAgent: AgentProfile = {
        id: makeId('ag'),
        workspaceId: WORKSPACE_ID,
        ownerUid: provisionedUid || user.uid,
        agentCode: codeClean,
        name: input.name.trim(),
        phone: phoneDigits,
        email: authEmail,
        assignedArea: areaClean,
        city: input.city?.trim() || areaClean,
        upiId: input.upiId?.trim() || '',
        approvalStatus: 'approved',
        commissionRate: Math.max(
          0,
          Math.min(100, Number(input.commissionRate) || 0)
        ),
        commissionPerConversion: Math.max(
          0,
          Number(input.commissionPerConversion) || 0
        ),
        defaultYearlyFee: Math.max(0, Number(input.defaultYearlyFee) || 0),
        passcodeHash,
        password: passwordClean,
        isActive: true,
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateAgent(user, newAgent);
        await cloudSyncPortalLogin(user, {
          role: 'agent',
          accountId: newAgent.id,
          phone: phoneDigits,
          password: passwordClean,
          displayName: newAgent.name,
          legacyAuthEmail: authEmail,
        }).catch(() => {});
        setPlatformError(null);
        return { ok: true, agent: newAgent };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [agents, isConfigured, user]
  );

  const updateAgent = useCallback(
    async (
      agentId: string,
      updates: {
        agentCode: string;
        name: string;
        phone: string;
        email: string;
        assignedArea: string;
        city?: string;
        upiId?: string;
        approvalStatus?: AgentApprovalStatus;
        commissionRate: number;
        commissionPerConversion?: number;
        defaultYearlyFee: number;
        newPasscode?: string;
        isActive: boolean;
      }
    ) => {
      if (!user || !isConfigured) {
        return { ok: false, error: 'Sign in with Google Admin first.' };
      }
      const existing = agents.find((a) => a.id === agentId);
      if (!existing) return { ok: false, error: 'Agent not found.' };

      const phoneClean = normalizePhoneDigits(updates.phone) || normalizePhoneDigits(existing.phone);
      const emailClean =
        updates.email.trim().toLowerCase() || existing.email || buildAgentAuthEmail(phoneClean);
      if (!emailClean.includes('@')) {
        return {
          ok: false,
          error: 'Enter a valid mobile phone number or login email for this Agent.',
        };
      }

      const trimmedNewPass = updates.newPasscode?.trim() ?? '';
      if (trimmedNewPass && trimmedNewPass.length < 4) {
        return {
          ok: false,
          error: 'New password must be at least 4 characters long.',
        };
      }

      const passcodeHash = trimmedNewPass
        ? await hashSecret(trimmedNewPass)
        : existing.passcodeHash;
      const plainPassword = trimmedNewPass || existing.password;

      const nextStatus: AgentApprovalStatus =
        updates.approvalStatus ??
        (updates.isActive ? 'approved' : 'suspended');

      const updated: AgentProfile = {
        ...existing,
        agentCode: updates.agentCode.trim().toUpperCase() || existing.agentCode,
        name: updates.name.trim() || existing.name,
        phone: phoneClean || updates.phone.trim() || existing.phone,
        email: emailClean,
        assignedArea: updates.assignedArea.trim() || existing.assignedArea,
        city: updates.city !== undefined ? updates.city.trim() : existing.city,
        upiId: updates.upiId !== undefined ? updates.upiId.trim() : existing.upiId,
        approvalStatus: nextStatus,
        commissionRate: Math.max(
          0,
          Math.min(100, Number(updates.commissionRate) || 0)
        ),
        commissionPerConversion:
          updates.commissionPerConversion !== undefined
            ? Math.max(0, Number(updates.commissionPerConversion) || 0)
            : existing.commissionPerConversion ?? 0,
        defaultYearlyFee: Math.max(0, Number(updates.defaultYearlyFee) || 0),
        passcodeHash,
        ...(typeof plainPassword === 'string' && plainPassword.length > 0
          ? { password: plainPassword }
          : {}),
        isActive: nextStatus === 'approved' && updates.isActive,
        updatedAtMs: Date.now(),
      };

      try {
        await cloudUpdateAgent(updated);
        const existingPhoneDigits = normalizePhoneDigits(existing.phone);
        if (
          existing.password &&
          (trimmedNewPass || existingPhoneDigits !== phoneClean) &&
          existingPhoneDigits.length >= 7
        ) {
          await cloudDeletePortalLogin(
            'agent',
            existingPhoneDigits,
            existing.password
          );
        }
        if (plainPassword && phoneClean.length >= 7) {
          await cloudSyncPortalLogin(user, {
            role: 'agent',
            accountId: updated.id,
            phone: phoneClean,
            password: plainPassword,
            displayName: updated.name,
            legacyAuthEmail: updated.email,
          }).catch(() => {});
        }
        setPlatformError(null);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [agents, isConfigured, user]
  );

  const toggleAgentActive = useCallback(
    async (agentId: string) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return;
      const nextActive = !target.isActive;
      await updateAgent(agentId, {
        agentCode: target.agentCode,
        name: target.name,
        phone: target.phone,
        email: target.email,
        assignedArea: target.assignedArea,
        city: target.city,
        upiId: target.upiId,
        approvalStatus: nextActive ? 'approved' : 'suspended',
        commissionRate: target.commissionRate,
        commissionPerConversion: target.commissionPerConversion,
        defaultYearlyFee: target.defaultYearlyFee,
        isActive: nextActive,
      });
    },
    [agents, updateAgent]
  );

  const setAgentApprovalStatus = useCallback(
    async (
      agentId: string,
      status: AgentApprovalStatus,
      commissionPerConversion?: number,
      commissionRate?: number
    ) => {
      const target = agents.find((a) => a.id === agentId);
      if (!target) return { ok: false, error: 'Agent not found.' };
      return updateAgent(agentId, {
        agentCode: target.agentCode,
        name: target.name,
        phone: target.phone,
        email: target.email,
        assignedArea: target.assignedArea,
        city: target.city,
        upiId: target.upiId,
        approvalStatus: status,
        commissionRate: commissionRate ?? target.commissionRate,
        commissionPerConversion:
          commissionPerConversion ?? target.commissionPerConversion,
        defaultYearlyFee: target.defaultYearlyFee,
        isActive: status === 'approved',
      });
    },
    [agents, updateAgent]
  );

  const adminOverrideSubscription = useCallback(
    async (
      parentId: string,
      action: 'activate' | 'extend_year' | 'suspend'
    ) => {
      if (!user || !isConfigured) {
        return { ok: false, error: 'Sign in with Google Admin first.' };
      }
      const latest = getLatestSubscriptionForParent(parentId);
      if (!latest) {
        return {
          ok: false,
          error: 'No subscription record found for this parent.',
        };
      }

      const today = todayIsoDate();
      let nextStatus: SubscriptionStatus = latest.status;
      let nextStart = latest.startDate;
      let nextExpiry = latest.expiryDate;
      let nextNote = latest.receiptNote;

      if (action === 'suspend') {
        nextStatus = 'suspended';
        nextNote = `${latest.receiptNote ? `${latest.receiptNote} · ` : ''}Suspended by Admin (${today})`.slice(0, 160);
      } else if (action === 'activate') {
        nextStatus = 'active';
        if (latest.expiryDate < today) {
          nextStart = today;
          nextExpiry = addOneYearIso(today);
        }
        nextNote = `${latest.receiptNote ? `${latest.receiptNote} · ` : ''}Activated by Admin (${today})`.slice(0, 160);
      } else if (action === 'extend_year') {
        nextStatus = 'active';
        const baseDate = latest.expiryDate >= today ? latest.expiryDate : today;
        nextExpiry = addOneYearIso(baseDate);
        nextNote = `${latest.receiptNote ? `${latest.receiptNote} · ` : ''}Extended +1 yr by Admin (${today})`.slice(0, 160);
      }

      const updated: SubscriptionRecord = {
        ...latest,
        startDate: nextStart,
        expiryDate: nextExpiry,
        status: nextStatus,
        receiptNote: nextNote,
        updatedAtMs: Date.now(),
      };

      try {
        await cloudUpdateSubscription(updated);
        setPlatformError(null);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [getLatestSubscriptionForParent, isConfigured, user]
  );

  const markPayoutPaid = useCallback(
    async (payoutId: string, utrNumber: string) => {
      const cleanUtr = utrNumber.trim();
      if (!cleanUtr) {
        return {
          ok: false,
          error: 'Enter the bank/UPI UTR Transaction Reference before settling.',
        };
      }
      const paidAt = todayIsoDate();
      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.payoutRequests = local.payoutRequests.map((p) =>
          p.id === payoutId
            ? { ...p, status: 'paid', utrNumber: cleanUtr, paidAt, updatedAtMs: Date.now() }
            : p
        );
        saveLocalGrowthState(local);
        setPayoutRequests(local.payoutRequests);
        return { ok: true };
      }
      try {
        await cloudMarkPayoutPaid(payoutId, cleanUtr, paidAt);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [isConfigured]
  );

  const generateOfflineVoucher = useCallback(
    async (agentId?: string) => {
      const targetAgent = agentId
        ? agents.find((a) => a.id === agentId)
        : undefined;
      const code = makeVoucherCode();
      const now = Date.now();
      const voucher: OfflineVoucher = {
        id: code,
        code,
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'admin_local',
        agentId: targetAgent?.id || '',
        agentEmail: targetAgent?.email || '',
        agentName: targetAgent?.name || '',
        planAmount: ANNUAL_PLAN_PRICE_INR,
        status: 'unused',
        redeemedByUid: '',
        redeemedByEmail: '',
        createdAtMs: now,
        redeemedAt: '',
      };

      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.vouchers = [voucher, ...local.vouchers];
        saveLocalGrowthState(local);
        setVouchers(local.vouchers);
        return { ok: true, voucher };
      }

      if (!user) {
        return { ok: false, error: 'Sign in with Google Admin first.' };
      }
      try {
        await cloudCreateOfflineVoucher(user, voucher);
        return { ok: true, voucher };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [agents, isConfigured, user]
  );

  const updateAppConfig = useCallback(
    async (patch: {
      dailyChallengeSeed: string;
      announcementEnabled: boolean;
      announcementText: string;
    }) => {
      const next: AppGlobalConfig = {
        id: 'global',
        dailyChallengeSeed:
          patch.dailyChallengeSeed.trim() || DEFAULT_APP_CONFIG.dailyChallengeSeed,
        announcementEnabled: patch.announcementEnabled,
        announcementText: patch.announcementText.trim(),
        updatedAtMs: Date.now(),
      };
      if (!isConfigured) {
        const local = loadLocalGrowthState();
        local.appConfig = next;
        saveLocalGrowthState(local);
        setAppConfig(next);
        return { ok: true };
      }
      try {
        await cloudSaveAppConfig(next);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [isConfigured]
  );

  const moderateLeaderboardEntry = useCallback(
    async (
      entryId: string,
      patch: { isHidden?: boolean; isFlagged?: boolean; flagReason?: string }
    ) => {
      try {
        await cloudUpdateLeaderboardModeration(entryId, patch);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    []
  );

  const moderateChildChampion = useCallback(
    async (childId: string, isHidden: boolean) => {
      try {
        await cloudUpdateChildLeaderboardVisibility(childId, isHidden);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Agent Operations (Family Onboarding)
  // ---------------------------------------------------------------------------

  const onboardParentAccount = useCallback(
    async (input: {
      agentId: string;
      parentName: string;
      parentContact: string;
      parentEmail: string;
      parentPasscode: string;
      children: ChildOnboardingInput[];
      feeAmount: number;
      paymentMethod: PaymentMethod;
      receiptNote: string;
      startDate: string;
    }) => {
      if (!user || !isConfigured) {
        return {
          ok: false,
          error: 'Sign in with Google to save families to Cloud Firestore.',
        };
      }
      const agent = agents.find((a) => a.id === input.agentId);
      if (!agent) {
        return { ok: false, error: 'Agent profile could not be verified.' };
      }
      if (getAgentApprovalStatus(agent) !== 'approved' || !agent.isActive) {
        return {
          ok: false,
          error: 'Your Agent account is pending Admin approval before onboarding families.',
        };
      }

      const contactDigits = normalizePhoneDigits(input.parentContact);
      const contactClean = contactDigits || input.parentContact.trim();
      const rawEmailClean = input.parentEmail.trim().toLowerCase();
      const passwordClean = input.parentPasscode.trim();
      if (!input.parentName.trim() || contactDigits.length < 7) {
        return {
          ok: false,
          error: 'Parent Name and a valid Mobile Number (at least 7 digits) are required.',
        };
      }
      if (passwordClean.length < 4) {
        return {
          ok: false,
          error: 'Parent Password must be at least 4 characters long.',
        };
      }
      if (rawEmailClean && !rawEmailClean.includes('@')) {
        return {
          ok: false,
          error: 'Enter a valid Google Email or leave it blank to use Mobile + Password login.',
        };
      }
      if (input.children.length === 0) {
        return { ok: false, error: 'Add at least one Child profile.' };
      }

      const parentAuthEmail = buildParentAuthEmail(contactDigits);
      const emailClean = rawEmailClean || parentAuthEmail;

      const existingParent = parents.some(
        (p) =>
          normalizePhoneDigits(p.contact) === contactDigits ||
          (rawEmailClean && p.email.toLowerCase() === rawEmailClean) ||
          (p.authEmail && p.authEmail.toLowerCase() === parentAuthEmail)
      );
      if (existingParent) {
        return {
          ok: false,
          error: 'A Parent account with this mobile number or email already exists.',
        };
      }

      for (const ch of input.children) {
        if (!ch.name.trim()) {
          return {
            ok: false,
            error: 'Each child profile requires a Child Name and Class/Grade.',
          };
        }
      }

      if (passwordClean.length >= 6) {
        try {
          await provisionPhoneAuthAccount(parentAuthEmail, passwordClean, true);
        } catch {
          // Non-fatal: /portalLogin bridge handles sign-in regardless of legacy auth collisions
        }
      }

      const now = Date.now();
      const parentId = makeId('par');
      const parentHash = await hashSecret(passwordClean);

      const newParent: ParentProfile = {
        id: parentId,
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        name: input.parentName.trim(),
        contact: contactClean,
        email: emailClean,
        authEmail: parentAuthEmail,
        passcodeHash: parentHash,
        password: passwordClean,
        createdByAgentId: agent.id,
        agentEmail: agent.email,
        agentName: agent.name,
        agentPhone: agent.phone,
        agentArea: agent.assignedArea,
        agentCode: agent.agentCode,
        createdAtMs: now,
        updatedAtMs: now,
      };

      const newChildren: ChildProfile[] = input.children.map((ch) => ({
        id: makeId('ch'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        parentId,
        createdByAgentId: agent.id,
        parentEmail: emailClean,
        parentAuthEmail,
        agentEmail: agent.email,
        name: ch.name.trim(),
        grade: normalizeIndianClass(ch.grade),
        totalScore: 0,
        sessionsCount: 0,
        bestStreak: 0,
        createdAtMs: now,
        updatedAtMs: now,
      }));

      const startDate = input.startDate || todayIsoDate();
      const newSub: SubscriptionRecord = {
        id: makeId('sub'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        parentId,
        parentEmail: emailClean,
        parentAuthEmail,
        agentEmail: agent.email,
        planType: 'yearly',
        startDate,
        expiryDate: addOneYearIso(startDate),
        feeAmount: Math.max(0, Number(input.feeAmount) || 0),
        paymentMethod: input.paymentMethod,
        receiptNote: input.receiptNote.trim(),
        collectedByAgentId: agent.id,
        status: 'active',
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateParent(user, newParent);
        await Promise.all([
          ...newChildren.map((ch) => cloudCreateChild(user, ch)),
          cloudCreateSubscription(user, newSub),
        ]);
        await cloudSyncPortalLogin(user, {
          role: 'parent',
          accountId: newParent.id,
          phone: contactDigits,
          password: passwordClean,
          displayName: newParent.name,
          legacyAuthEmail: parentAuthEmail,
        }).catch(() => {});
        setPlatformError(null);
        return { ok: true, parent: newParent };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [agents, isConfigured, parents, user]
  );

  const addChildToParent = useCallback(
    async (parentId: string, agentId: string, ch: ChildOnboardingInput) => {
      if (!user || !isConfigured) {
        return {
          ok: false,
          error: 'Sign in first to add a child profile.',
        };
      }
      if (!ch.name.trim()) {
        return { ok: false, error: 'Child Name and Class/Grade are required.' };
      }
      const parent = parents.find((p) => p.id === parentId);
      const agent = agents.find((a) => a.id === agentId);
      if (!parent) {
        return { ok: false, error: 'Parent record not found.' };
      }

      const now = Date.now();
      const newChild: ChildProfile = {
        id: makeId('ch'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        parentId,
        createdByAgentId: agentId,
        parentEmail: parent.email,
        parentAuthEmail:
          parent.authEmail || buildParentAuthEmail(parent.contact) || undefined,
        agentEmail: agent?.email ?? parent.agentEmail,
        name: ch.name.trim(),
        grade: normalizeIndianClass(ch.grade),
        totalScore: 0,
        sessionsCount: 0,
        bestStreak: 0,
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateChild(user, newChild);
        setPlatformError(null);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [agents, isConfigured, parents, user]
  );

  const renewParentSubscription = useCallback(
    async (input: {
      parentId: string;
      agentId: string;
      feeAmount: number;
      paymentMethod: PaymentMethod;
      receiptNote: string;
      startDate: string;
    }) => {
      if (!user || !isConfigured) {
        return {
          ok: false,
          error: 'Sign in first to record a renewal.',
        };
      }
      const parent = parents.find((p) => p.id === input.parentId);
      const agent = agents.find((a) => a.id === input.agentId);
      if (!parent) {
        return { ok: false, error: 'Parent account not found.' };
      }

      const startDate = input.startDate || todayIsoDate();
      const now = Date.now();
      const renewal: SubscriptionRecord = {
        id: makeId('sub'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        parentId: input.parentId,
        parentEmail: parent.email,
        parentAuthEmail:
          parent.authEmail || buildParentAuthEmail(parent.contact) || undefined,
        agentEmail: agent?.email ?? parent.agentEmail,
        planType: 'yearly',
        startDate,
        expiryDate: addOneYearIso(startDate),
        feeAmount: Math.max(0, Number(input.feeAmount) || 0),
        paymentMethod: input.paymentMethod,
        receiptNote: input.receiptNote.trim() || 'Yearly Renewal',
        collectedByAgentId: input.agentId,
        status: 'active',
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateSubscription(user, renewal);
        setPlatformError(null);
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setPlatformError(msg);
        return { ok: false, error: msg };
      }
    },
    [agents, isConfigured, parents, user]
  );

  // ---------------------------------------------------------------------------
  // Child Practice Session Recording & Live Champions Sync
  // ---------------------------------------------------------------------------

  const recordChildPractice = useCallback(
    async (childId: string, session: SessionRecord): Promise<boolean> => {
      if (!user || !isConfigured) return false;
      const child = children.find((c) => c.id === childId);
      if (!child) return false;

      let weakTopic: WeakTopic = 'none';
      const attempts = session.attempts ?? [];
      if (attempts.length > 0) {
        const opStats: Record<
          ConcreteOperation,
          { total: number; missed: number }
        > = {
          addition: { total: 0, missed: 0 },
          subtraction: { total: 0, missed: 0 },
          multiplication: { total: 0, missed: 0 },
          division: { total: 0, missed: 0 },
        };
        for (const a of attempts) {
          opStats[a.operation].total += 1;
          if (a.outcome !== 'correct') {
            opStats[a.operation].missed += 1;
          }
        }
        let worstRate = 0;
        for (const op of Object.keys(opStats) as ConcreteOperation[]) {
          const { total, missed } = opStats[op];
          if (total > 0 && missed > 0) {
            const missRate = missed / total;
            if (missRate > worstRate) {
              worstRate = missRate;
              weakTopic = op;
            }
          }
        }
      } else if (session.mode !== 'mixed' && session.accuracy < 80) {
        weakTopic = session.mode;
      }

      const matchedParent = parents.find((p) => p.id === child.parentId);
      const practiceDoc: PracticeSession = {
        id: makeId('ps'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        childId: child.id,
        parentId: child.parentId,
        parentEmail: child.parentEmail,
        parentAuthEmail:
          child.parentAuthEmail ||
          matchedParent?.authEmail ||
          (matchedParent ? buildParentAuthEmail(matchedParent.contact) : '') ||
          undefined,
        agentEmail: child.agentEmail,
        grade: normalizeIndianClass(session.grade ?? child.grade),
        mode: session.mode,
        difficulty: session.difficulty,
        sessionType: session.sessionType,
        durationSec: session.durationSec,
        elapsedSec: session.elapsedSec,
        score: session.score,
        attempted: session.attempted,
        correct: session.correct,
        accuracy: session.accuracy,
        bestStreak: session.bestStreak,
        avgResponseMs: session.avgResponseMs,
        qpm: session.qpm,
        allowNegatives: session.allowNegatives,
        weakTopic,
        createdAtMs: session.createdAtMs,
      };

      const nextTotalScore = (child.totalScore || 0) + Math.max(0, session.score);
      const nextSessionsCount = (child.sessionsCount || 0) + 1;
      const nextBestStreak = Math.max(child.bestStreak || 0, session.bestStreak);

      try {
        await cloudCreatePracticeSession(user, practiceDoc);
        await cloudUpdateChildScoreAndLeaderboard(
          user,
          child,
          nextTotalScore,
          nextSessionsCount,
          nextBestStreak
        );
        setPlatformError(null);
        return true;
      } catch (err) {
        setPlatformError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [children, isConfigured, parents, user]
  );

  const dismissPlatformError = useCallback(() => setPlatformError(null), []);
  const dismissRoleResolveNotice = useCallback(
    () => setRoleResolveNotice(null),
    []
  );

  const value = useMemo<PlatformContextValue>(
    () => ({
      agents,
      parents,
      children,
      subscriptions,
      practiceSessions,
      leads,
      studentSubscriptions,
      payoutRequests,
      vouchers,
      appConfig,
      topChampions,
      topChampionsLoading,
      topChampionsError,
      childLeaderboard,
      platformLoading,
      roleSession,
      autoRouteEvent,
      roleResolveNotice,
      platformError,
      isGoogleAdmin,
      dismissPlatformError,
      dismissRoleResolveNotice,
      capturedReferralCode,
      isProSubscriber,
      myStudentSubscription,
      freeAdaptiveUsedCount,
      markFreeAdaptiveUsed,
      customPresets,
      saveCustomPreset,
      deleteCustomPreset,
      isCheckoutOpen,
      checkoutInitialTab,
      openCheckoutModal,
      closeCheckoutModal,
      validatePromoCode,
      completeAnnualCheckout,
      redeemOfflineVoucher,
      recordTrialLeadIfReferred,
      signInAndRouteWithGoogle,
      signInWithGoogleRedirectFlow,
      loginAgentPhonePassword,
      loginAgentPasscode,
      loginParentPhonePassword,
      loginParentPasscode,
      registerSalesAgent,
      updateAgentSelfProfile,
      changeAgentPassword,
      changeParentPassword,
      requestAgentPayout,
      switchToChildMode,
      exitChildModeToParent,
      logoutRole,
      createAgent,
      updateAgent,
      toggleAgentActive,
      setAgentApprovalStatus,
      adminOverrideSubscription,
      markPayoutPaid,
      generateOfflineVoucher,
      updateAppConfig,
      moderateLeaderboardEntry,
      moderateChildChampion,
      onboardParentAccount,
      addChildToParent,
      renewParentSubscription,
      recordChildPractice,
      getAgentById,
      getParentById,
      getChildById,
      getChildrenForParent,
      getLatestSubscriptionForParent,
      getSubscriptionHistoryForParent,
      getChildStats,
    }),
    [
      agents,
      parents,
      children,
      subscriptions,
      practiceSessions,
      leads,
      studentSubscriptions,
      payoutRequests,
      vouchers,
      appConfig,
      topChampions,
      topChampionsLoading,
      topChampionsError,
      childLeaderboard,
      platformLoading,
      roleSession,
      autoRouteEvent,
      roleResolveNotice,
      platformError,
      isGoogleAdmin,
      dismissPlatformError,
      dismissRoleResolveNotice,
      capturedReferralCode,
      isProSubscriber,
      myStudentSubscription,
      freeAdaptiveUsedCount,
      markFreeAdaptiveUsed,
      customPresets,
      saveCustomPreset,
      deleteCustomPreset,
      isCheckoutOpen,
      checkoutInitialTab,
      openCheckoutModal,
      closeCheckoutModal,
      validatePromoCode,
      completeAnnualCheckout,
      redeemOfflineVoucher,
      recordTrialLeadIfReferred,
      signInAndRouteWithGoogle,
      signInWithGoogleRedirectFlow,
      loginAgentPhonePassword,
      loginAgentPasscode,
      loginParentPhonePassword,
      loginParentPasscode,
      registerSalesAgent,
      updateAgentSelfProfile,
      changeAgentPassword,
      changeParentPassword,
      requestAgentPayout,
      switchToChildMode,
      exitChildModeToParent,
      logoutRole,
      createAgent,
      updateAgent,
      toggleAgentActive,
      setAgentApprovalStatus,
      adminOverrideSubscription,
      markPayoutPaid,
      generateOfflineVoucher,
      updateAppConfig,
      moderateLeaderboardEntry,
      moderateChildChampion,
      onboardParentAccount,
      addChildToParent,
      renewParentSubscription,
      recordChildPractice,
      getAgentById,
      getParentById,
      getChildById,
      getChildrenForParent,
      getLatestSubscriptionForParent,
      getSubscriptionHistoryForParent,
      getChildStats,
    ]
  );

  return (
    <PlatformContext.Provider value={value}>
      {reactChildren}
    </PlatformContext.Provider>
  );
};

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return ctx;
}
