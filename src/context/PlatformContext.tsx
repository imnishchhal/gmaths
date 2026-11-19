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
  cloudUpdateSubscription,
  loadLocalPlatformStore,
  PlatformSnapshot,
  saveLocalPlatformStore,
  subscribePlatformWorkspace,
} from '../lib/platformStorage';
import {
  AgentProfile,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildOnboardingInput,
  ChildProfile,
  LOCAL_ADMIN_DEFAULT_EMAIL,
  ParentProfile,
  PaymentMethod,
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
import { ConcreteOperation, SessionRecord } from '../types/math';
import { hashSecret, verifySecret } from '../utils/crypto';

const ROLE_SESSION_KEY = 'gmaths_active_role_v1';
const LOCAL_ADMIN_PASSCODE = 'admin123';

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function mergeById<T extends { id: string; updatedAtMs?: number; createdAtMs: number }>(
  localItems: T[],
  cloudItems: T[]
): T[] {
  const map = new Map<string, T>();
  for (const item of localItems) map.set(item.id, item);
  for (const item of cloudItems) map.set(item.id, item);
  return Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

function loadStoredRoleSession(): RoleSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ROLE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoleSession;
    if (parsed && parsed.role && parsed.accountId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export interface ChildStatsSummary {
  totalSessions: number;
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  bestStreak: number;
  avgResponseMs: number;
  weakTopics: Array<{ topic: ConcreteOperation; sessionsFlagged: number; avgAccuracy: number }>;
  recentSessions: PracticeSession[];
}

interface PlatformContextValue {
  agents: AgentProfile[];
  parents: ParentProfile[];
  children: ChildProfile[];
  subscriptions: SubscriptionRecord[];
  practiceSessions: PracticeSession[];
  roleSession: RoleSession | null;
  platformError: string | null;
  isGoogleAdmin: boolean;
  dismissPlatformError: () => void;

  // Role Authentication
  loginAdminWithCredentials: (
    email: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginAdminWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
  loginAgent: (
    identifier: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginParent: (
    contact: string,
    passcode: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginChild: (
    username: string,
    pin: string
  ) => Promise<{ ok: boolean; error?: string }>;
  switchToChildMode: (childId: string) => { ok: boolean; error?: string };
  exitChildModeToParent: () => void;
  logoutRole: () => void;

  // Admin Operations
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

  // Agent Operations
  onboardParentAccount: (input: {
    agentId: string;
    parentName: string;
    parentContact: string;
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
  ) => Promise<void>;

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
  const { user, authReady, isConfigured, signInWithGoogle } = useFirebase();

  const [localStore, setLocalStore] = useState<PlatformSnapshot>(() =>
    loadLocalPlatformStore()
  );
  const [cloudAgents, setCloudAgents] = useState<AgentProfile[]>([]);
  const [cloudParents, setCloudParents] = useState<ParentProfile[]>([]);
  const [cloudChildren, setCloudChildren] = useState<ChildProfile[]>([]);
  const [cloudSubscriptions, setCloudSubscriptions] = useState<
    SubscriptionRecord[]
  >([]);
  const [cloudPracticeSessions, setCloudPracticeSessions] = useState<
    PracticeSession[]
  >([]);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [roleSession, setRoleSession] = useState<RoleSession | null>(() =>
    loadStoredRoleSession()
  );

  const isGoogleAdmin = Boolean(
    user && user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL
  );

  const persistRoleSession = useCallback((next: RoleSession | null) => {
    setRoleSession(next);
    if (typeof window !== 'undefined') {
      try {
        if (next) {
          window.localStorage.setItem(ROLE_SESSION_KEY, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(ROLE_SESSION_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    }
  }, []);

  const updateLocal = useCallback(
    (updater: (prev: PlatformSnapshot) => PlatformSnapshot) => {
      setLocalStore((prev) => {
        const next = updater(prev);
        saveLocalPlatformStore(next);
        return next;
      });
    },
    []
  );

  // Attach Firestore listeners when authenticated with Google
  useEffect(() => {
    if (!authReady || !user || !isConfigured) {
      setCloudAgents([]);
      setCloudParents([]);
      setCloudChildren([]);
      setCloudSubscriptions([]);
      setCloudPracticeSessions([]);
      return;
    }

    const unsub = subscribePlatformWorkspace(user, {
      onAgents: setCloudAgents,
      onParents: setCloudParents,
      onChildren: setCloudChildren,
      onSubscriptions: setCloudSubscriptions,
      onPracticeSessions: setCloudPracticeSessions,
      onError: (err) => setPlatformError(err.message),
    });

    return () => unsub();
  }, [authReady, user, isConfigured]);

  const agents = useMemo(
    () => mergeById(localStore.agents, cloudAgents),
    [localStore.agents, cloudAgents]
  );
  const parents = useMemo(
    () => mergeById(localStore.parents, cloudParents),
    [localStore.parents, cloudParents]
  );
  const children = useMemo(
    () => mergeById(localStore.children, cloudChildren),
    [localStore.children, cloudChildren]
  );
  const subscriptions = useMemo(
    () => mergeById(localStore.subscriptions, cloudSubscriptions),
    [localStore.subscriptions, cloudSubscriptions]
  );
  const practiceSessions = useMemo(
    () => mergeById(localStore.practiceSessions, cloudPracticeSessions),
    [localStore.practiceSessions, cloudPracticeSessions]
  );

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
      const childRuns = practiceSessions.filter((s) => s.childId === childId);
      if (childRuns.length === 0) {
        return {
          totalSessions: 0,
          totalAttempted: 0,
          totalCorrect: 0,
          accuracy: 0,
          bestStreak: 0,
          avgResponseMs: 0,
          weakTopics: [],
          recentSessions: [],
        };
      }

      let totalAttempted = 0;
      let totalCorrect = 0;
      let bestStreak = 0;
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
        totalSessions: childRuns.length,
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
    [practiceSessions]
  );

  // ---------------------------------------------------------------------------
  // Role Authentication Handlers
  // ---------------------------------------------------------------------------

  const loginAdminWithCredentials = useCallback(
    async (email: string, passcode: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (
        (normalizedEmail === LOCAL_ADMIN_DEFAULT_EMAIL ||
          normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL) &&
        passcode.trim() === LOCAL_ADMIN_PASSCODE
      ) {
        persistRoleSession({
          role: 'admin',
          accountId: 'admin_console',
          displayName: 'Platform Admin',
        });
        return { ok: true };
      }
      return {
        ok: false,
        error: `Invalid Admin credentials. Use ${LOCAL_ADMIN_DEFAULT_EMAIL} with passcode ${LOCAL_ADMIN_PASSCODE}, or sign in with Google.`,
      };
    },
    [persistRoleSession]
  );

  const [pendingGoogleAdmin, setPendingGoogleAdmin] = useState(false);

  const loginAdminWithGoogle = useCallback(async () => {
    if (!isConfigured) {
      return {
        ok: false,
        error: 'Firebase is not configured. Use local Admin credentials below.',
      };
    }
    if (isGoogleAdmin && user) {
      persistRoleSession({
        role: 'admin',
        accountId: user.uid,
        displayName: user.displayName || 'Platform Admin',
      });
      return { ok: true };
    }
    setPendingGoogleAdmin(true);
    await signInWithGoogle();
    return { ok: true };
  }, [isConfigured, isGoogleAdmin, persistRoleSession, signInWithGoogle, user]);

  useEffect(() => {
    if (pendingGoogleAdmin && isGoogleAdmin && user) {
      persistRoleSession({
        role: 'admin',
        accountId: user.uid,
        displayName: user.displayName || 'Platform Admin',
      });
      setPendingGoogleAdmin(false);
    }
  }, [isGoogleAdmin, pendingGoogleAdmin, persistRoleSession, user]);
  const loginAgent = useCallback(
    async (identifier: string, passcode: string) => {
      const idTrim = identifier.trim().toLowerCase();
      if (!idTrim || !passcode.trim()) {
        return { ok: false, error: 'Enter your Agent ID/phone/email and passcode.' };
      }
      const match = agents.find(
        (a) =>
          a.agentCode.toLowerCase() === idTrim ||
          a.phone.toLowerCase() === idTrim ||
          (a.email && a.email.toLowerCase() === idTrim)
      );
      if (!match) {
        return {
          ok: false,
          error:
            'Agent account not found. Ask your Admin to create your Agent profile in /admin.',
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
      persistRoleSession({
        role: 'agent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [agents, persistRoleSession]
  );

  const loginParent = useCallback(
    async (contact: string, passcode: string) => {
      const target = contact.trim().toLowerCase();
      if (!target || !passcode.trim()) {
        return { ok: false, error: 'Enter your registered mobile/email and passcode.' };
      }
      const match = parents.find((p) => p.contact.trim().toLowerCase() === target);
      if (!match) {
        return {
          ok: false,
          error:
            'Parent account not found. Ask your field Agent to onboard your family account.',
        };
      }
      const valid = await verifySecret(passcode, match.passcodeHash);
      if (!valid) {
        return { ok: false, error: 'Incorrect Parent passcode or PIN.' };
      }
      persistRoleSession({
        role: 'parent',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [parents, persistRoleSession]
  );

  const loginChild = useCallback(
    async (username: string, pin: string) => {
      const uname = username.trim().toLowerCase();
      if (!uname || !pin.trim()) {
        return { ok: false, error: 'Enter your student username and PIN.' };
      }
      const match = children.find((c) => c.username.toLowerCase() === uname);
      if (!match) {
        return { ok: false, error: 'Student username not found.' };
      }
      const valid = await verifySecret(pin, match.pinHash);
      if (!valid) {
        return { ok: false, error: 'Incorrect student PIN.' };
      }
      persistRoleSession({
        role: 'child',
        accountId: match.id,
        displayName: match.name,
      });
      return { ok: true };
    },
    [children, persistRoleSession]
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
      persistRoleSession({
        role: 'child',
        accountId: child.id,
        displayName: child.name,
        returnToParentId: child.parentId,
      });
      return { ok: true };
    },
    [children, getLatestSubscriptionForParent, persistRoleSession]
  );

  const exitChildModeToParent = useCallback(() => {
    if (roleSession?.role === 'child' && roleSession.returnToParentId) {
      const parent = parents.find((p) => p.id === roleSession.returnToParentId);
      if (parent) {
        persistRoleSession({
          role: 'parent',
          accountId: parent.id,
          displayName: parent.name,
        });
        return;
      }
    }
    persistRoleSession(null);
  }, [parents, persistRoleSession, roleSession]);

  const logoutRole = useCallback(() => {
    persistRoleSession(null);
  }, [persistRoleSession]);

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
      commissionRate: number;
      defaultYearlyFee: number;
      passcode: string;
    }) => {
      const codeClean = input.agentCode.trim().toUpperCase();
      if (!codeClean || !input.name.trim() || !input.phone.trim() || !input.passcode.trim()) {
        return { ok: false, error: 'Name, Agent ID, Phone, and Passcode are required.' };
      }
      const duplicate = agents.some(
        (a) => a.agentCode.toLowerCase() === codeClean.toLowerCase()
      );
      if (duplicate) {
        return { ok: false, error: `Agent ID "${codeClean}" already exists.` };
      }

      const now = Date.now();
      const passcodeHash = await hashSecret(input.passcode);
      const newAgent: AgentProfile = {
        id: makeId('ag'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'local_admin',
        agentCode: codeClean,
        name: input.name.trim(),
        phone: input.phone.trim(),
        email: input.email.trim(),
        assignedArea: input.assignedArea.trim() || 'General',
        commissionRate: Math.max(0, Math.min(100, Number(input.commissionRate) || 0)),
        defaultYearlyFee: Math.max(0, Number(input.defaultYearlyFee) || 0),
        passcodeHash,
        isActive: true,
        createdAtMs: now,
        updatedAtMs: now,
      };

      updateLocal((prev) => ({
        ...prev,
        agents: [newAgent, ...prev.agents],
      }));

      if (user && isConfigured) {
        try {
          await cloudCreateAgent(user, newAgent);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }

      return { ok: true, agent: newAgent };
    },
    [agents, isConfigured, updateLocal, user]
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
      const existing = agents.find((a) => a.id === agentId);
      if (!existing) return { ok: false, error: 'Agent not found.' };

      const passcodeHash = updates.newPasscode?.trim()
        ? await hashSecret(updates.newPasscode)
        : existing.passcodeHash;

      const updated: AgentProfile = {
        ...existing,
        agentCode: updates.agentCode.trim().toUpperCase() || existing.agentCode,
        name: updates.name.trim() || existing.name,
        phone: updates.phone.trim() || existing.phone,
        email: updates.email.trim(),
        assignedArea: updates.assignedArea.trim() || existing.assignedArea,
        commissionRate: Math.max(0, Math.min(100, Number(updates.commissionRate) || 0)),
        defaultYearlyFee: Math.max(0, Number(updates.defaultYearlyFee) || 0),
        passcodeHash,
        isActive: updates.isActive,
        updatedAtMs: Date.now(),
      };

      updateLocal((prev) => ({
        ...prev,
        agents: prev.agents.some((a) => a.id === agentId)
          ? prev.agents.map((a) => (a.id === agentId ? updated : a))
          : [updated, ...prev.agents],
      }));

      if (user && isConfigured) {
        try {
          await cloudUpdateAgent(updated);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }
      return { ok: true };
    },
    [agents, isConfigured, updateLocal, user]
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
      const latest = getLatestSubscriptionForParent(parentId);
      if (!latest) {
        return { ok: false, error: 'No subscription record found for this parent.' };
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

      updateLocal((prev) => ({
        ...prev,
        subscriptions: prev.subscriptions.some((s) => s.id === updated.id)
          ? prev.subscriptions.map((s) => (s.id === updated.id ? updated : s))
          : [updated, ...prev.subscriptions],
      }));

      if (user && isConfigured) {
        try {
          await cloudUpdateSubscription(updated);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }

      return { ok: true };
    },
    [getLatestSubscriptionForParent, isConfigured, updateLocal, user]
  );

  // ---------------------------------------------------------------------------
  // Agent Operations
  // ---------------------------------------------------------------------------

  const onboardParentAccount = useCallback(
    async (input: {
      agentId: string;
      parentName: string;
      parentContact: string;
      parentPasscode: string;
      children: ChildOnboardingInput[];
      feeAmount: number;
      paymentMethod: PaymentMethod;
      receiptNote: string;
      startDate: string;
    }) => {
      const contactClean = input.parentContact.trim();
      if (!input.parentName.trim() || !contactClean || !input.parentPasscode.trim()) {
        return {
          ok: false,
          error: 'Parent Name, Mobile/Email, and Password/PIN are required.',
        };
      }
      if (input.children.length === 0) {
        return { ok: false, error: 'Add at least one Child profile.' };
      }

      const existingParent = parents.some(
        (p) => p.contact.trim().toLowerCase() === contactClean.toLowerCase()
      );
      if (existingParent) {
        return {
          ok: false,
          error: 'A Parent account with this mobile/email already exists.',
        };
      }

      const existingUsernames = new Set(
        children.map((c) => c.username.toLowerCase())
      );
      for (const ch of input.children) {
        const uname = ch.username.trim().toLowerCase();
        if (!ch.name.trim() || uname.length < 2 || !ch.pin.trim()) {
          return {
            ok: false,
            error: 'Each child needs a Name, Username (2+ chars), and PIN.',
          };
        }
        if (existingUsernames.has(uname)) {
          return {
            ok: false,
            error: `Student username "${ch.username}" is already taken.`,
          };
        }
        existingUsernames.add(uname);
      }

      const now = Date.now();
      const ownerUid = user?.uid || 'local_admin';
      const parentId = makeId('par');
      const parentHash = await hashSecret(input.parentPasscode);

      const newParent: ParentProfile = {
        id: parentId,
        workspaceId: WORKSPACE_ID,
        ownerUid,
        name: input.parentName.trim(),
        contact: contactClean,
        passcodeHash: parentHash,
        createdByAgentId: input.agentId,
        createdAtMs: now,
        updatedAtMs: now,
      };

      const newChildren: ChildProfile[] = [];
      for (const ch of input.children) {
        const pinHash = await hashSecret(ch.pin);
        newChildren.push({
          id: makeId('ch'),
          workspaceId: WORKSPACE_ID,
          ownerUid,
          parentId,
          createdByAgentId: input.agentId,
          name: ch.name.trim(),
          age: Math.max(3, Math.min(20, Math.round(Number(ch.age) || 8))),
          grade: ch.grade.trim() || 'Grade 3',
          username: ch.username.trim().toLowerCase().replace(/[^a-z0-9_.\-]/g, ''),
          pinHash,
          createdAtMs: now,
          updatedAtMs: now,
        });
      }

      const startDate = input.startDate || todayIsoDate();
      const newSub: SubscriptionRecord = {
        id: makeId('sub'),
        workspaceId: WORKSPACE_ID,
        ownerUid,
        parentId,
        planType: 'yearly',
        startDate,
        expiryDate: addOneYearIso(startDate),
        feeAmount: Math.max(0, Number(input.feeAmount) || 0),
        paymentMethod: input.paymentMethod,
        receiptNote: input.receiptNote.trim(),
        collectedByAgentId: input.agentId,
        status: 'active',
        createdAtMs: now,
        updatedAtMs: now,
      };

      updateLocal((prev) => ({
        ...prev,
        parents: [newParent, ...prev.parents],
        children: [...newChildren, ...prev.children],
        subscriptions: [newSub, ...prev.subscriptions],
      }));

      if (user && isConfigured) {
        try {
          // Sequential parent create first so Firestore exists(/parents/{parentId}) rules pass
          await cloudCreateParent(user, newParent);
          await Promise.all([
            ...newChildren.map((ch) => cloudCreateChild(user, ch)),
            cloudCreateSubscription(user, newSub),
          ]);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }

      return { ok: true, parent: newParent };
    },
    [children, isConfigured, parents, updateLocal, user]
  );

  const addChildToParent = useCallback(
    async (parentId: string, agentId: string, ch: ChildOnboardingInput) => {
      const uname = ch.username.trim().toLowerCase().replace(/[^a-z0-9_.\-]/g, '');
      if (!ch.name.trim() || uname.length < 2 || !ch.pin.trim()) {
        return { ok: false, error: 'Child Name, Username (2+ chars), and PIN are required.' };
      }
      if (children.some((existing) => existing.username.toLowerCase() === uname)) {
        return { ok: false, error: `Username "${uname}" is already in use.` };
      }
      const now = Date.now();
      const newChild: ChildProfile = {
        id: makeId('ch'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'local_admin',
        parentId,
        createdByAgentId: agentId,
        name: ch.name.trim(),
        age: Math.max(3, Math.min(20, Math.round(Number(ch.age) || 8))),
        grade: ch.grade.trim() || 'Grade 3',
        username: uname,
        pinHash: await hashSecret(ch.pin),
        createdAtMs: now,
        updatedAtMs: now,
      };

      updateLocal((prev) => ({
        ...prev,
        children: [newChild, ...prev.children],
      }));

      if (user && isConfigured) {
        try {
          await cloudCreateChild(user, newChild);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }
      return { ok: true };
    },
    [children, isConfigured, updateLocal, user]
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
      const startDate = input.startDate || todayIsoDate();
      const now = Date.now();
      const renewal: SubscriptionRecord = {
        id: makeId('sub'),
        workspaceId: WORKSPACE_ID,
        ownerUid: user?.uid || 'local_admin',
        parentId: input.parentId,
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

      updateLocal((prev) => ({
        ...prev,
        subscriptions: [renewal, ...prev.subscriptions],
      }));

      if (user && isConfigured) {
        try {
          await cloudCreateSubscription(user, renewal);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }

      return { ok: true };
    },
    [isConfigured, updateLocal, user]
  );

  // ---------------------------------------------------------------------------
  // Child Practice Session Recording
  // ---------------------------------------------------------------------------

  const recordChildPractice = useCallback(
    async (childId: string, session: SessionRecord) => {
      const child = children.find((c) => c.id === childId);
      if (!child) return;

      // Determine weakest operation from attempt logs (if any missed or slow)
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
        ownerUid: user?.uid || 'local_admin',
        childId: child.id,
        parentId: child.parentId,
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

      updateLocal((prev) => ({
        ...prev,
        practiceSessions: [practiceDoc, ...prev.practiceSessions],
      }));

      if (user && isConfigured) {
        try {
          await cloudCreatePracticeSession(user, practiceDoc);
        } catch (err) {
          setPlatformError(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [children, isConfigured, updateLocal, user]
  );

  const dismissPlatformError = useCallback(() => setPlatformError(null), []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      agents,
      parents,
      children,
      subscriptions,
      practiceSessions,
      roleSession,
      platformError,
      isGoogleAdmin,
      dismissPlatformError,
      loginAdminWithCredentials,
      loginAdminWithGoogle,
      loginAgent,
      loginParent,
      loginChild,
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
      roleSession,
      platformError,
      isGoogleAdmin,
      dismissPlatformError,
      loginAdminWithCredentials,
      loginAdminWithGoogle,
      loginAgent,
      loginParent,
      loginChild,
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
