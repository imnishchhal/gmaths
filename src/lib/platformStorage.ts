import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  AgentProfile,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildLeaderboardEntry,
  ChildProfile,
  ParentProfile,
  PaymentMethod,
  PracticeSession,
  RoleSession,
  SubscriptionRecord,
  SubscriptionStatus,
  WORKSPACE_ID,
  WeakTopic,
} from '../types/platform';
import {
  ArithmeticMode,
  Difficulty,
  SessionType,
  normalizeIndianClass,
} from '../types/math';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  ALLOWED_DIFFICULTIES,
  ALLOWED_MODES,
  ALLOWED_SESSION_TYPES,
  sanitizeId,
} from './firestoreValidation';

function tsToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  return Date.now();
}

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function sanitizeCode(raw: string, fallback: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 32);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function sanitizeEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 120);
}

function sanitizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function sanitizeHash(raw: string): string {
  const trimmed = raw.trim().slice(0, 128);
  return trimmed.length >= 16 ? trimmed : trimmed.padEnd(16, '0');
}

function mapAgentDoc(id: string, x: DocumentData, fallbackUid: string): AgentProfile {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    agentCode: String(x.agentCode ?? ''),
    name: String(x.name ?? ''),
    phone: String(x.phone ?? ''),
    email: sanitizeEmail(String(x.email ?? '')),
    assignedArea: String(x.assignedArea ?? ''),
    commissionRate: Number(x.commissionRate ?? 0),
    defaultYearlyFee: Number(x.defaultYearlyFee ?? 0),
    passcodeHash: String(x.passcodeHash ?? ''),
    isActive: Boolean(x.isActive),
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapParentDoc(id: string, x: DocumentData, fallbackUid: string): ParentProfile {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    name: String(x.name ?? ''),
    contact: String(x.contact ?? ''),
    email: sanitizeEmail(String(x.email ?? '')),
    passcodeHash: String(x.passcodeHash ?? ''),
    createdByAgentId: String(x.createdByAgentId ?? ''),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    agentName: String(x.agentName ?? 'Field Agent'),
    agentPhone: String(x.agentPhone ?? ''),
    agentArea: String(x.agentArea ?? ''),
    agentCode: String(x.agentCode ?? ''),
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapChildDoc(id: string, x: DocumentData, fallbackUid: string): ChildProfile {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    parentId: String(x.parentId ?? ''),
    createdByAgentId: String(x.createdByAgentId ?? ''),
    parentEmail: sanitizeEmail(String(x.parentEmail ?? '')),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    name: String(x.name ?? ''),
    grade: normalizeIndianClass(String(x.grade ?? '3rd')),
    totalScore: Math.max(0, Math.round(Number(x.totalScore ?? 0))),
    sessionsCount: Math.max(0, Math.round(Number(x.sessionsCount ?? 0))),
    bestStreak: Math.max(0, Math.round(Number(x.bestStreak ?? 0))),
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapSubDoc(id: string, x: DocumentData, fallbackUid: string): SubscriptionRecord {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    parentId: String(x.parentId ?? ''),
    parentEmail: sanitizeEmail(String(x.parentEmail ?? '')),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    planType: 'yearly',
    startDate: String(x.startDate ?? ''),
    expiryDate: String(x.expiryDate ?? ''),
    feeAmount: Number(x.feeAmount ?? 0),
    paymentMethod: (x.paymentMethod as PaymentMethod) ?? 'cash',
    receiptNote: String(x.receiptNote ?? ''),
    collectedByAgentId: String(x.collectedByAgentId ?? ''),
    status: (x.status as SubscriptionStatus) ?? 'active',
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapPracticeDoc(id: string, x: DocumentData, fallbackUid: string): PracticeSession {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    childId: String(x.childId ?? ''),
    parentId: String(x.parentId ?? ''),
    parentEmail: sanitizeEmail(String(x.parentEmail ?? '')),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    grade: normalizeIndianClass(String(x.grade ?? '3rd')),
    mode: (x.mode as ArithmeticMode) ?? 'mixed',
    difficulty: (x.difficulty as Difficulty) ?? 'medium',
    sessionType: (x.sessionType as SessionType) ?? 'sprint',
    durationSec: Number(x.durationSec ?? 60),
    elapsedSec: Number(x.elapsedSec ?? 0),
    score: Number(x.score ?? 0),
    attempted: Number(x.attempted ?? 0),
    correct: Number(x.correct ?? 0),
    accuracy: Number(x.accuracy ?? 0),
    bestStreak: Number(x.bestStreak ?? 0),
    avgResponseMs: Number(x.avgResponseMs ?? 0),
    qpm: Number(x.qpm ?? 0),
    allowNegatives: Boolean(x.allowNegatives),
    weakTopic: (x.weakTopic as WeakTopic) ?? 'none',
    createdAtMs: tsToMs(x.createdAt),
  };
}

function mapChildLeaderboardDoc(id: string, x: DocumentData): ChildLeaderboardEntry {
  return {
    id: String(x.id ?? id),
    childId: String(x.childId ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? ''),
    name: String(x.name ?? 'Student'),
    grade: normalizeIndianClass(String(x.grade ?? '3rd')),
    totalScore: Math.max(0, Math.round(Number(x.totalScore ?? 0))),
    sessionsCount: Math.max(0, Math.round(Number(x.sessionsCount ?? 0))),
    bestStreak: Math.max(0, Math.round(Number(x.bestStreak ?? 0))),
    isPublic: true,
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

/**
 * Merges multiple Firestore queries for the same collection into a single real-time stream.
 * Each sub-query satisfies Firestore Security Rules using single-field equality filters
 * (no composite indexes required, instant cross-device sync on desktop & mobile).
 */
function subscribeMergedQueries<T extends { id: string; createdAtMs: number }>(
  queries: Array<{ key: string; q: Query<DocumentData>; path: string }>,
  mapper: (id: string, data: DocumentData) => T,
  onMerged: (items: T[]) => void,
  onError: (err: Error) => void,
  onFirstSettle?: () => void
): Unsubscribe {
  if (queries.length === 0) {
    onMerged([]);
    onFirstSettle?.();
    return () => {};
  }

  const buckets = new Map<string, T[]>();
  const settledKeys = new Set<string>();
  let notifiedSettle = false;

  const emit = () => {
    const byId = new Map<string, T>();
    for (const list of buckets.values()) {
      for (const item of list) {
        byId.set(item.id, item);
      }
    }
    const merged = Array.from(byId.values()).sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
    onMerged(merged);
  };

  const markSettled = (key: string) => {
    settledKeys.add(key);
    if (!notifiedSettle && settledKeys.size >= queries.length) {
      notifiedSettle = true;
      onFirstSettle?.();
    }
  };

  const unsubs = queries.map(({ key, q, path }) =>
    onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        buckets.set(
          key,
          snap.docs.map((d) => mapper(d.id, d.data()))
        );
        emit();
        markSettled(key);
      },
      (error) => {
        markSettled(key);
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (wrapped) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    )
  );

  return () => {
    for (const u of unsubs) u();
  };
}

// -----------------------------------------------------------------------------
// Automatic Role Lookup from Cloud Firestore on Google Sign-In
// -----------------------------------------------------------------------------

export interface ResolvedFirestoreRole {
  session: RoleSession | null;
  route: '/admin' | '/agent' | '/parent' | '/';
  inactiveAgent?: boolean;
}

export async function resolveUserRoleFromFirestore(
  user: User
): Promise<ResolvedFirestoreRole> {
  if (!db) return { session: null, route: '/' };

  const emailLower = sanitizeEmail(user.email ?? '');

  // 1. Bootstrapped Platform Admin
  if (user.emailVerified && emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
    return {
      session: {
        role: 'admin',
        accountId: user.uid,
        displayName: user.displayName || 'Platform Admin',
      },
      route: '/admin',
    };
  }

  // 2. Explicit /admins/{uid} doc
  try {
    const adminSnap = await getDoc(doc(db, 'admins', user.uid));
    if (adminSnap.exists()) {
      return {
        session: {
          role: 'admin',
          accountId: user.uid,
          displayName: user.displayName || 'Platform Admin',
        },
        route: '/admin',
      };
    }
  } catch {
    // Not an admin or unverified email — continue checking agent/parent
  }

  if (!user.emailVerified || !emailLower) {
    return { session: null, route: '/' };
  }

  // 3. Field Agent matched by verified Google email
  try {
    const agentSnap = await getDocs(
      query(collection(db, 'agents'), where('email', '==', emailLower), limit(5))
    );
    if (!agentSnap.empty) {
      const matchedAgents = agentSnap.docs.map((d) =>
        mapAgentDoc(d.id, d.data(), user.uid)
      );
      const activeAgent = matchedAgents.find((a) => a.isActive);
      if (activeAgent) {
        return {
          session: {
            role: 'agent',
            accountId: activeAgent.id,
            displayName: activeAgent.name,
          },
          route: '/agent',
        };
      }
      return { session: null, route: '/', inactiveAgent: true };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'agents');
  }

  // 4. Parent matched by verified Google email
  try {
    const parentSnap = await getDocs(
      query(collection(db, 'parents'), where('email', '==', emailLower), limit(5))
    );
    if (!parentSnap.empty) {
      const parentDoc = parentSnap.docs[0];
      const parent = mapParentDoc(parentDoc.id, parentDoc.data(), user.uid);
      return {
        session: {
          role: 'parent',
          accountId: parent.id,
          displayName: parent.name,
        },
        route: '/parent',
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'parents');
  }

  return { session: null, route: '/' };
}

// -----------------------------------------------------------------------------
// Real-Time Cloud Firestore Workspace Subscriptions (Cross-Device Sync)
// -----------------------------------------------------------------------------

export function subscribePlatformWorkspace(
  user: User,
  handlers: {
    onAgents: (items: AgentProfile[]) => void;
    onParents: (items: ParentProfile[]) => void;
    onChildren: (items: ChildProfile[]) => void;
    onSubscriptions: (items: SubscriptionRecord[]) => void;
    onPracticeSessions: (items: PracticeSession[]) => void;
    onReady?: () => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  if (!db) {
    handlers.onReady?.();
    return () => {};
  }
  const firestore = db;

  const emailLower = sanitizeEmail(user.email ?? '');
  const isBootstrappedAdmin =
    Boolean(user.emailVerified) && emailLower === BOOTSTRAPPED_ADMIN_EMAIL;

  let settledCollections = 0;
  const markCollectionSettled = () => {
    settledCollections += 1;
    if (settledCollections >= 5) {
      handlers.onReady?.();
    }
  };

  const agentQueries: Array<{ key: string; q: Query<DocumentData>; path: string }> =
    isBootstrappedAdmin
      ? [
          {
            key: 'ws',
            path: 'agents',
            q: query(
              collection(firestore, 'agents'),
              where('workspaceId', '==', WORKSPACE_ID),
              limit(250)
            ),
          },
        ]
      : [
          {
            key: 'owner',
            path: 'agents',
            q: query(
              collection(firestore, 'agents'),
              where('ownerUid', '==', user.uid),
              limit(250)
            ),
          },
          ...(user.emailVerified && emailLower.length >= 3
            ? [
                {
                  key: 'email',
                  path: 'agents',
                  q: query(
                    collection(firestore, 'agents'),
                    where('email', '==', emailLower),
                    limit(50)
                  ),
                },
              ]
            : []),
        ];

  const parentQueries: Array<{ key: string; q: Query<DocumentData>; path: string }> =
    isBootstrappedAdmin
      ? [
          {
            key: 'ws',
            path: 'parents',
            q: query(
              collection(firestore, 'parents'),
              where('workspaceId', '==', WORKSPACE_ID),
              limit(250)
            ),
          },
        ]
      : [
          {
            key: 'owner',
            path: 'parents',
            q: query(
              collection(firestore, 'parents'),
              where('ownerUid', '==', user.uid),
              limit(250)
            ),
          },
          ...(user.emailVerified && emailLower.length >= 3
            ? [
                {
                  key: 'agentEmail',
                  path: 'parents',
                  q: query(
                    collection(firestore, 'parents'),
                    where('agentEmail', '==', emailLower),
                    limit(250)
                  ),
                },
                {
                  key: 'parentEmail',
                  path: 'parents',
                  q: query(
                    collection(firestore, 'parents'),
                    where('email', '==', emailLower),
                    limit(25)
                  ),
                },
              ]
            : []),
        ];

  const buildFamilyQueries = (
    colName: 'children' | 'subscriptions' | 'practiceSessions'
  ) =>
    isBootstrappedAdmin
      ? [
          {
            key: 'ws',
            path: colName,
            q: query(
              collection(firestore, colName),
              where('workspaceId', '==', WORKSPACE_ID),
              limit(250)
            ),
          },
        ]
      : [
          {
            key: 'owner',
            path: colName,
            q: query(
              collection(firestore, colName),
              where('ownerUid', '==', user.uid),
              limit(250)
            ),
          },
          ...(user.emailVerified && emailLower.length >= 3
            ? [
                {
                  key: 'agentEmail',
                  path: colName,
                  q: query(
                    collection(firestore, colName),
                    where('agentEmail', '==', emailLower),
                    limit(250)
                  ),
                },
                {
                  key: 'parentEmail',
                  path: colName,
                  q: query(
                    collection(firestore, colName),
                    where('parentEmail', '==', emailLower),
                    limit(250)
                  ),
                },
              ]
            : []),
        ];

  const unsubs: Unsubscribe[] = [
    subscribeMergedQueries(
      agentQueries,
      (id, data) => mapAgentDoc(id, data, user.uid),
      handlers.onAgents,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      parentQueries,
      (id, data) => mapParentDoc(id, data, user.uid),
      handlers.onParents,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      buildFamilyQueries('children'),
      (id, data) => mapChildDoc(id, data, user.uid),
      handlers.onChildren,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      buildFamilyQueries('subscriptions'),
      (id, data) => mapSubDoc(id, data, user.uid),
      handlers.onSubscriptions,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      buildFamilyQueries('practiceSessions'),
      (id, data) => mapPracticeDoc(id, data, user.uid),
      handlers.onPracticeSessions,
      handlers.onError,
      markCollectionSettled
    ),
  ];

  return () => {
    for (const u of unsubs) u();
  };
}

// -----------------------------------------------------------------------------
// Public Real-Time Child Champions Query (Home Page Top 3 & Full Board)
// -----------------------------------------------------------------------------

export function subscribeChildChampions(
  maxResults: number,
  onItems: (items: ChildLeaderboardEntry[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!db) {
    onItems([]);
    return () => {};
  }

  // Single-field automatic index on totalScore (zero composite index required)
  const q = query(
    collection(db, 'childLeaderboard'),
    where('totalScore', '>=', 1),
    orderBy('totalScore', 'desc'),
    limit(Math.max(1, Math.min(50, maxResults)))
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapChildLeaderboardDoc(d.id, d.data()))
        .sort((a, b) => {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
          return a.name.localeCompare(b.name);
        });
      onItems(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'childLeaderboard');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

// -----------------------------------------------------------------------------
// Cloud Firestore Mutations (strictly synchronized with firebase-blueprint.json)
// -----------------------------------------------------------------------------

export async function cloudCreateAgent(
  user: User,
  agent: AgentProfile
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  const email = sanitizeEmail(agent.email);
  if (email.length < 3) {
    throw new Error('Agent email is required for cross-device Google Sign-In.');
  }
  try {
    await setDoc(doc(db, 'agents', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
      name: (agent.name.trim() || 'Agent').slice(0, 80),
      phone: (agent.phone.trim() || '000').slice(0, 40),
      email,
      assignedArea: (agent.assignedArea.trim() || 'General').slice(0, 80),
      commissionRate: clamp(agent.commissionRate, 0, 100),
      defaultYearlyFee: clamp(agent.defaultYearlyFee, 0, 1000000),
      passcodeHash: sanitizeHash(agent.passcodeHash),
      isActive: Boolean(agent.isActive),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudUpdateAgent(agent: AgentProfile): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  const email = sanitizeEmail(agent.email);
  if (email.length < 3) {
    throw new Error('Agent email is required for cross-device Google Sign-In.');
  }
  try {
    await updateDoc(doc(db, 'agents', id), {
      agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
      name: (agent.name.trim() || 'Agent').slice(0, 80),
      phone: (agent.phone.trim() || '000').slice(0, 40),
      email,
      assignedArea: (agent.assignedArea.trim() || 'General').slice(0, 80),
      commissionRate: clamp(agent.commissionRate, 0, 100),
      defaultYearlyFee: clamp(agent.defaultYearlyFee, 0, 1000000),
      passcodeHash: sanitizeHash(agent.passcodeHash),
      isActive: Boolean(agent.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudCreateParent(
  user: User,
  parent: ParentProfile
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(parent.id, 'par');
  const path = `parents/${id}`;
  try {
    await setDoc(doc(db, 'parents', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      name: (parent.name.trim() || 'Parent').slice(0, 80),
      contact: (parent.contact.trim() || '000').slice(0, 120),
      email: sanitizeEmail(parent.email),
      passcodeHash: sanitizeHash(parent.passcodeHash),
      createdByAgentId: sanitizeId(parent.createdByAgentId, 'ag'),
      agentEmail: sanitizeEmail(parent.agentEmail),
      agentName: (parent.agentName.trim() || 'Field Agent').slice(0, 80),
      agentPhone: (parent.agentPhone.trim() || '000').slice(0, 40),
      agentArea: (parent.agentArea.trim() || 'General').slice(0, 80),
      agentCode: sanitizeCode(parent.agentCode, 'AG01'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudCreateChild(
  user: User,
  child: ChildProfile
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(child.id, 'ch');
  const path = `children/${id}`;
  try {
    await setDoc(doc(db, 'children', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(child.parentId, 'par'),
      createdByAgentId: sanitizeId(child.createdByAgentId, 'ag'),
      parentEmail: sanitizeEmail(child.parentEmail),
      agentEmail: sanitizeEmail(child.agentEmail),
      name: (child.name.trim() || 'Student').slice(0, 60),
      grade: normalizeIndianClass(child.grade),
      totalScore: Math.round(clamp(child.totalScore, 0, 10000000)),
      sessionsCount: Math.round(clamp(child.sessionsCount, 0, 1000000)),
      bestStreak: Math.round(clamp(child.bestStreak, 0, 10000)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudCreateSubscription(
  user: User,
  sub: SubscriptionRecord
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(sub.id, 'sub');
  const path = `subscriptions/${id}`;
  try {
    await setDoc(doc(db, 'subscriptions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(sub.parentId, 'par'),
      parentEmail: sanitizeEmail(sub.parentEmail),
      agentEmail: sanitizeEmail(sub.agentEmail),
      planType: 'yearly',
      startDate: sanitizeDate(sub.startDate),
      expiryDate: sanitizeDate(sub.expiryDate),
      feeAmount: clamp(sub.feeAmount, 0, 1000000),
      paymentMethod: ['cash', 'upi', 'bank'].includes(sub.paymentMethod)
        ? sub.paymentMethod
        : 'cash',
      receiptNote: sub.receiptNote.trim().slice(0, 160),
      collectedByAgentId: sanitizeId(sub.collectedByAgentId, 'ag'),
      status: ['active', 'expired', 'suspended'].includes(sub.status)
        ? sub.status
        : 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudUpdateSubscription(
  sub: SubscriptionRecord
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(sub.id, 'sub');
  const path = `subscriptions/${id}`;
  try {
    await updateDoc(doc(db, 'subscriptions', id), {
      startDate: sanitizeDate(sub.startDate),
      expiryDate: sanitizeDate(sub.expiryDate),
      feeAmount: clamp(sub.feeAmount, 0, 1000000),
      paymentMethod: ['cash', 'upi', 'bank'].includes(sub.paymentMethod)
        ? sub.paymentMethod
        : 'cash',
      receiptNote: sub.receiptNote.trim().slice(0, 160),
      collectedByAgentId: sanitizeId(sub.collectedByAgentId, 'ag'),
      status: ['active', 'expired', 'suspended'].includes(sub.status)
        ? sub.status
        : 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudCreatePracticeSession(
  user: User,
  session: PracticeSession
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const id = sanitizeId(session.id, 'ps');
  const path = `practiceSessions/${id}`;
  const score = Math.round(clamp(session.score, 0, 5000));
  const attempted = Math.max(score, Math.round(clamp(session.attempted, 0, 10000)));
  const bestStreak = Math.round(clamp(session.bestStreak, 0, score));
  const mode: ArithmeticMode = ALLOWED_MODES.includes(session.mode)
    ? session.mode
    : 'mixed';
  const difficulty: Difficulty = ALLOWED_DIFFICULTIES.includes(session.difficulty)
    ? session.difficulty
    : 'medium';
  const sessionType: SessionType = ALLOWED_SESSION_TYPES.includes(
    session.sessionType
  )
    ? session.sessionType
    : 'sprint';
  const weakTopic: WeakTopic = [
    'none',
    'addition',
    'subtraction',
    'multiplication',
    'division',
  ].includes(session.weakTopic)
    ? session.weakTopic
    : 'none';

  try {
    await setDoc(doc(db, 'practiceSessions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      childId: sanitizeId(session.childId, 'ch'),
      parentId: sanitizeId(session.parentId, 'par'),
      parentEmail: sanitizeEmail(session.parentEmail),
      agentEmail: sanitizeEmail(session.agentEmail),
      grade: normalizeIndianClass(session.grade),
      mode,
      difficulty,
      sessionType,
      durationSec:
        sessionType === 'sprint'
          ? Math.round(clamp(session.durationSec, 0, 3600))
          : 0,
      elapsedSec: Math.round(clamp(session.elapsedSec, 0, 7200) * 10) / 10,
      score,
      attempted,
      correct: score,
      accuracy: Math.round(clamp(session.accuracy, 0, 100) * 10) / 10,
      bestStreak,
      avgResponseMs: Math.round(clamp(session.avgResponseMs, 0, 600000)),
      qpm: Math.round(clamp(session.qpm, 0, 600) * 10) / 10,
      allowNegatives: Boolean(session.allowNegatives),
      weakTopic,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cloudUpdateChildScoreAndLeaderboard(
  user: User,
  child: ChildProfile,
  nextTotalScore: number,
  nextSessionsCount: number,
  nextBestStreak: number
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const childId = sanitizeId(child.id, 'ch');
  const safeTotalScore = Math.round(clamp(nextTotalScore, 0, 10000000));
  const safeSessionsCount = Math.round(clamp(nextSessionsCount, 0, 1000000));
  const safeBestStreak = Math.round(clamp(nextBestStreak, 0, 10000));
  const safeGrade = normalizeIndianClass(child.grade);
  const safeName = (child.name.trim() || 'Student').slice(0, 60);

  // 1. Update aggregate counters on /children/{childId}
  try {
    await updateDoc(doc(db, 'children', childId), {
      totalScore: safeTotalScore,
      sessionsCount: safeSessionsCount,
      bestStreak: safeBestStreak,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `children/${childId}`);
  }

  // 2. Upsert zero-PII public leaderboard record on /childLeaderboard/{childId} when score >= 1
  if (safeTotalScore < 1) return;

  const lbRef = doc(db, 'childLeaderboard', childId);
  const lbPath = `childLeaderboard/${childId}`;
  let existing = false;
  try {
    const snap = await getDoc(lbRef);
    existing = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, lbPath);
  }

  if (existing) {
    try {
      await updateDoc(lbRef, {
        name: safeName,
        grade: safeGrade,
        totalScore: safeTotalScore,
        sessionsCount: Math.max(1, safeSessionsCount),
        bestStreak: safeBestStreak,
        ownerUid: sanitizeId(user.uid, 'u'),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, lbPath);
    }
  } else {
    try {
      await setDoc(lbRef, {
        id: childId,
        childId,
        workspaceId: WORKSPACE_ID,
        ownerUid: sanitizeId(user.uid, 'u'),
        name: safeName,
        grade: safeGrade,
        totalScore: safeTotalScore,
        sessionsCount: Math.max(1, safeSessionsCount),
        bestStreak: safeBestStreak,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, lbPath);
    }
  }
}
