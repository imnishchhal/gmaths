import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFirebase } from './FirebaseContext';
import {
  cloudCreateAgent,
  cloudCreateChild,
  cloudCreateParent,
  cloudCreatePracticeSession,
  cloudCreateSubscription,
  cloudUpdateAgent,
  cloudUpdateChildScoreAndLeaderboard,
  cloudUpdateSubscription,
  resolveUserRoleFromFirestore,
  subscribeChildChampions,
  subscribePlatformWorkspace,
} from '../lib/platformStorage';
import {
  AgentProfile,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildLeaderboardEntry,
  ChildOnboardingInput,
  ChildProfile,
  ParentProfile,
  PaymentMethod,
  PlatformRoute,
  PracticeSession,
  RoleSession,
  SubscriptionRecord,
  SubscriptionStatus,
  WORKSPACE_ID,
  WeakTopic,
  addOneYearIso,
  evaluateSubscriptionState,
  todayIsoDate,
} from '../types/platform';
import {
  ConcreteOperation,
  SessionRecord,
  normalizeIndianClass,
} from '../types/math';
import { hashSecret, verifySecret } from '../utils/crypto';

const ACTIVE_CHILD_SESSION_KEY = 'gmaths_active_child_session_v1';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
  topChampions: ChildLeaderboardEntry[];
  topChampionsLoading: boolean;
  topChampionsError: string | null;
  childLeaderboard: ChildLeaderboardEntry[];
  platformLoading: boolean;
  roleSession: RoleSession | null;
  /** Emitted after explicit Google Sign-In so App routes to the assigned dashboard */
  autoRouteEvent: { seq: number; route: PlatformRoute } | null;
  roleResolveNotice: string | null;
  platformError: string | null;
  isGoogleAdmin: boolean;
  dismissPlatformError: () => void;
  dismissRoleResolveNotice: () => void;

  // Role Authentication (Google-first + Cloud Firestore verified)
  signInAndRouteWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  signInWithGoogleRedirectFlow: () => Promise<void>;
  loginAgentPasscode: (
    identifier: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginParentPasscode: (
    contact: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  switchToChildMode: (childId: string) => {
    ok: boolean;
    error?: string;
    child?: ChildProfile;
  };
  exitChildModeToParent: () => void;
  logoutRole: () => Promise<void>;

  // Admin Operations (direct Cloud Firestore writes)
  createAgent: (input: {
    agentCode: string;
    name: string;
    phone: string;
    email: string;
    assignedArea: string;
    commissionRate: number;
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
      commissionRate: number;
      defaultYearlyFee: number;
      newPasscode?: string;
      isActive: boolean;
    }
  ) => Promise<{ ok: boolean; error?: string }>;
  toggleAgentActive: (agentId: string) => Promise<void>;
  adminOverrideSubscription: (
    parentId: string,
    action: 'activate' | 'extend_year' | 'suspend'
  ) => Promise<{ ok: boolean; error?: string }>;

  // Agent Operations (direct Cloud Firestore writes)
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

  // Child Practice Tracking (direct Cloud Firestore + Public Top 3 Leaderboard sync)
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
    signOutUser,
  } = useFirebase();

  // 100% Cloud Firestore live state (zero localStorage data fallback)
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [parents, setParents] = useState<ParentProfile[]>([]);
  const [children, setChildren] = useState<ChildProfile[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [platformLoading, setPlatformLoading] = useState<boolean>(false);

  // Public Top 3 & Top 50 Children Champions from /childLeaderboard
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

  const isGoogleAdmin = Boolean(
    user &&
      user.emailVerified &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
  );

  const updateRoleSession = useCallback((next: RoleSession | null) => {
    setRoleSession(next);
    saveActiveChildSession(next);
  }, []);

  // 1. Public real-time Top 3 Champions + full Children Leaderboard (works even before sign-in)
  useEffect(() => {
    if (!isConfigured) {
      setTopChampions([]);
      setChildLeaderboard([]);
      setTopChampionsLoading(false);
      return;
    }

    setTopChampionsLoading(true);
    const unsubTop3 = subscribeChildChampions(
      3,
      (items) => {
        setTopChampions(items);
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
        // Already surfaced via top3 error if offline
      }
    );

    return () => {
      unsubTop3();
      unsubAll();
    };
  }, [isConfigured]);

  // 2. Real-time Cloud Firestore workspace listeners scoped to verified Google user
  useEffect(() => {
    if (!authReady) return;
    if (!user || !isConfigured) {
      setAgents([]);
      setParents([]);
      setChildren([]);
      setSubscriptions([]);
      setPracticeSessions([]);
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
      onReady: () => setPlatformLoading(false),
      onError: (err) => {
        setPlatformError(err.message);
        setPlatformLoading(false);
      },
    });

    return () => unsub();
  }, [authReady, user, isConfigured, updateRoleSession]);

  // 3. Automatically resolve user's verified role from Firestore on session restore or explicit Google Sign-In
  useEffect(() => {
    if (!authReady || !user || !isConfigured) return;

    let cancelled = false;
    void resolveUserRoleFromFirestore(user)
      .then((resolved) => {
        if (cancelled) return;
        if (resolved.inactiveAgent) {
          setRoleResolveNotice(
            'Your Agent account is currently deactivated by Admin.'
          );
          return;
        }
        if (resolved.session) {
          setRoleResolveNotice(null);
          setRoleSession((current) => {
            // Preserve active one-tap Child session belonging to this Parent
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
            `Signed in as ${user.email}. No Admin, Agent, or Parent portal is linked to this email yet — you can practice freely on the Home screen or ask your Agent/Admin to add this email.`
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
  // Authentication & One-Tap Child Switching
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
          error: 'Your Agent account has been deactivated by Admin.',
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

  const loginAgentPasscode = useCallback(
    async (identifier: string, passcode: string) => {
      if (!user) {
        return {
          ok: false,
          error:
            'Sign in with Google first to load your Cloud Firestore records.',
        };
      }
      const idTrim = identifier.trim().toLowerCase();
      if (!idTrim || !passcode.trim()) {
        return {
          ok: false,
          error: 'Enter your Agent ID, phone, or email and passcode.',
        };
      }
      const match = agents.find(
        (a) =>
          a.agentCode.toLowerCase() === idTrim ||
          a.phone.toLowerCase() === idTrim ||
          a.email.toLowerCase() === idTrim
      );
      if (!match) {
        return {
          ok: false,
          error:
            'Agent profile not found in your synced workspace. Sign in with the Google email assigned to your Agent profile.',
        };
      }
      if (!match.isActive) {
        return {
          ok: false,
          error: 'This Agent account has been deactivated by Admin.',
        };
      }
      const valid = await verifySecret(passcode, match.passcodeHash);
      if (!valid) {
        return { ok: false, error: 'Incorrect Agent passcode.' };
      }
      updateRoleSession({
        role: 'agent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [agents, updateRoleSession, user]
  );

  const loginParentPasscode = useCallback(
    async (contact: string, passcode: string) => {
      if (!user) {
        return {
          ok: false,
          error:
            'Sign in with Google first to load your Cloud Firestore family account.',
        };
      }
      const target = contact.trim().toLowerCase();
      if (!target || !passcode.trim()) {
        return {
          ok: false,
          error: 'Enter your registered mobile or email and passcode.',
        };
      }
      const match = parents.find(
        (p) =>
          p.contact.trim().toLowerCase() === target ||
          p.email.trim().toLowerCase() === target
      );
      if (!match) {
        return {
          ok: false,
          error:
            'Parent account not found in your synced workspace. Sign in with the Google email linked by your Agent.',
        };
      }
      const valid = await verifySecret(passcode, match.passcodeHash);
      if (!valid) {
        return { ok: false, error: 'Incorrect Parent passcode.' };
      }
      updateRoleSession({
        role: 'parent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [parents, updateRoleSession, user]
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
  // Admin Operations (Direct Cloud Firestore Writes)
  // ---------------------------------------------------------------------------

  const createAgent = useCallback(
    async (input: {
      agentCode: string;
      name: string;
      phone: string;
      email: string;
      assignedArea: string;
      commissionRate: number;
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
      const emailClean = input.email.trim().toLowerCase();
      if (
        !codeClean ||
        !input.name.trim() ||
        !input.phone.trim() ||
        !emailClean.includes('@') ||
        !input.passcode.trim()
      ) {
        return {
          ok: false,
          error:
            'Name, Agent ID, Phone, valid Google Email, and Passcode are all required.',
        };
      }
      const duplicate = agents.some(
        (a) =>
          a.agentCode.toLowerCase() === codeClean.toLowerCase() ||
          a.email.toLowerCase() === emailClean
      );
      if (duplicate) {
        return {
          ok: false,
          error: `An Agent with ID "${codeClean}" or email "${emailClean}" already exists.`,
        };
      }

      const now = Date.now();
      const passcodeHash = await hashSecret(input.passcode);
      const newAgent: AgentProfile = {
        id: makeId('ag'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        agentCode: codeClean,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: emailClean,
        assignedArea: input.assignedArea.trim() || 'General',
        commissionRate: Math.max(
          0,
          Math.min(100, Number(input.commissionRate) || 0)
        ),
        defaultYearlyFee: Math.max(0, Number(input.defaultYearlyFee) || 0),
        passcodeHash,
        isActive: true,
        createdAtMs: now,
        updatedAtMs: now,
      };

      try {
        await cloudCreateAgent(user, newAgent);
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
        commissionRate: number;
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

      const emailClean = updates.email.trim().toLowerCase();
      if (!emailClean.includes('@')) {
        return {
          ok: false,
          error: 'A valid Google Email is required for cross-device Agent sync.',
        };
      }

      const passcodeHash = updates.newPasscode?.trim()
        ? await hashSecret(updates.newPasscode)
        : existing.passcodeHash;

      const updated: AgentProfile = {
        ...existing,
        agentCode: updates.agentCode.trim().toUpperCase() || existing.agentCode,
        name: updates.name.trim() || existing.name,
        phone: updates.phone.trim() || existing.phone,
        email: emailClean,
        assignedArea: updates.assignedArea.trim() || existing.assignedArea,
        commissionRate: Math.max(
          0,
          Math.min(100, Number(updates.commissionRate) || 0)
        ),
        defaultYearlyFee: Math.max(0, Number(updates.defaultYearlyFee) || 0),
        passcodeHash,
        isActive: updates.isActive,
        updatedAtMs: Date.now(),
      };

      try {
        await cloudUpdateAgent(updated);
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
      await updateAgent(agentId, {
        agentCode: target.agentCode,
        name: target.name,
        phone: target.phone,
        email: target.email,
        assignedArea: target.assignedArea,
        commissionRate: target.commissionRate,
        defaultYearlyFee: target.defaultYearlyFee,
        isActive: !target.isActive,
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

  // ---------------------------------------------------------------------------
  // Agent Operations (Direct Cloud Firestore Writes, Credential-Free Children)
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

      const contactClean = input.parentContact.trim();
      const emailClean = input.parentEmail.trim().toLowerCase();
      if (!input.parentName.trim() || !contactClean || !input.parentPasscode.trim()) {
        return {
          ok: false,
          error: 'Parent Name, Mobile Number, and Passcode are required.',
        };
      }
      if (!emailClean || !emailClean.includes('@')) {
        return {
          ok: false,
          error:
            'Enter the Parent Google Email so they can sign in on any mobile or desktop device.',
        };
      }
      if (input.children.length === 0) {
        return { ok: false, error: 'Add at least one Child profile.' };
      }

      const existingParent = parents.some(
        (p) =>
          p.contact.trim().toLowerCase() === contactClean.toLowerCase() ||
          (p.email && p.email.toLowerCase() === emailClean)
      );
      if (existingParent) {
        return {
          ok: false,
          error: 'A Parent account with this mobile or email already exists.',
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

      const now = Date.now();
      const parentId = makeId('par');
      const parentHash = await hashSecret(input.parentPasscode);

      const newParent: ParentProfile = {
        id: parentId,
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        name: input.parentName.trim(),
        contact: contactClean,
        email: emailClean,
        passcodeHash: parentHash,
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
        // Sequential Parent create first so Firestore exists(/parents/{parentId}) rules pass
        await cloudCreateParent(user, newParent);
        await Promise.all([
          ...newChildren.map((ch) => cloudCreateChild(user, ch)),
          cloudCreateSubscription(user, newSub),
        ]);
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
          error: 'Sign in with Google to add a child profile.',
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
          error: 'Sign in with Google to record a renewal.',
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
  // Child Practice Session Recording & Live Top 3 Champions Sync
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

      const practiceDoc: PracticeSession = {
        id: makeId('ps'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user.uid,
        childId: child.id,
        parentId: child.parentId,
        parentEmail: child.parentEmail,
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
    [children, isConfigured, user]
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
      signInAndRouteWithGoogle,
      signInWithGoogleRedirectFlow,
      loginAgentPasscode,
      loginParentPasscode,
      switchToChildMode,
      exitChildModeToParent,
      logoutRole,
      createAgent,
      updateAgent,
      toggleAgentActive,
      adminOverrideSubscription,
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
      signInAndRouteWithGoogle,
      signInWithGoogleRedirectFlow,
      loginAgentPasscode,
      loginParentPasscode,
      switchToChildMode,
      exitChildModeToParent,
      logoutRole,
      createAgent,
      updateAgent,
      toggleAgentActive,
      adminOverrideSubscription,
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
