import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  AgentProfile,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildProfile,
  ParentProfile,
  PaymentMethod,
  PracticeSession,
  SubscriptionRecord,
  SubscriptionStatus,
  WORKSPACE_ID,
  WeakTopic,
} from '../types/platform';
import { ArithmeticMode, Difficulty, SessionType } from '../types/math';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  ALLOWED_DIFFICULTIES,
  ALLOWED_MODES,
  ALLOWED_SESSION_TYPES,
  sanitizeId,
} from './firestoreValidation';

const LOCAL_STORE_KEY = 'gmaths_platform_store_v1';

export interface PlatformSnapshot {
  agents: AgentProfile[];
  parents: ParentProfile[];
  children: ChildProfile[];
  subscriptions: SubscriptionRecord[];
  practiceSessions: PracticeSession[];
}

const EMPTY_SNAPSHOT: PlatformSnapshot = {
  agents: [],
  parents: [],
  children: [],
  subscriptions: [],
  practiceSessions: [],
};

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

function sanitizeUsername(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.\-]/g, '')
    .slice(0, 32);
  return cleaned.length >= 2 ? cleaned : fallback;
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

export function loadLocalPlatformStore(): PlatformSnapshot {
  if (typeof window === 'undefined') return EMPTY_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORE_KEY);
    if (!raw) return EMPTY_SNAPSHOT;
    const parsed = JSON.parse(raw) as Partial<PlatformSnapshot>;
    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      parents: Array.isArray(parsed.parents) ? parsed.parents : [],
      children: Array.isArray(parsed.children) ? parsed.children : [],
      subscriptions: Array.isArray(parsed.subscriptions)
        ? parsed.subscriptions
        : [],
      practiceSessions: Array.isArray(parsed.practiceSessions)
        ? parsed.practiceSessions
        : [],
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export function saveLocalPlatformStore(snapshot: PlatformSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

// -----------------------------------------------------------------------------
// Cloud Firestore Subscriptions (attached ONLY when signed in via Google Auth)
// -----------------------------------------------------------------------------

function buildWorkspaceQuery(colName: string, user: User) {
  if (!db) return null;
  const isBootstrappedAdmin =
    user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL;
  if (isBootstrappedAdmin) {
    return query(
      collection(db, colName),
      where('workspaceId', '==', WORKSPACE_ID),
      limit(250)
    );
  }
  return query(
    collection(db, colName),
    where('ownerUid', '==', user.uid),
    limit(250)
  );
}

export function subscribePlatformWorkspace(
  user: User,
  handlers: {
    onAgents: (items: AgentProfile[]) => void;
    onParents: (items: ParentProfile[]) => void;
    onChildren: (items: ChildProfile[]) => void;
    onSubscriptions: (items: SubscriptionRecord[]) => void;
    onPracticeSessions: (items: PracticeSession[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  if (!db) return () => {};
  const unsubs: Unsubscribe[] = [];

  const handleErr = (path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (wrapped) {
      handlers.onError(
        wrapped instanceof Error ? wrapped : new Error(String(wrapped))
      );
    }
  };

  const qAgents = buildWorkspaceQuery('agents', user);
  if (qAgents) {
    unsubs.push(
      onSnapshot(
        qAgents,
        (snap) => {
          const items: AgentProfile[] = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: String(x.id ?? d.id),
              workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
              ownerUid: String(x.ownerUid ?? user.uid),
              agentCode: String(x.agentCode ?? ''),
              name: String(x.name ?? ''),
              phone: String(x.phone ?? ''),
              email: String(x.email ?? ''),
              assignedArea: String(x.assignedArea ?? ''),
              commissionRate: Number(x.commissionRate ?? 0),
              defaultYearlyFee: Number(x.defaultYearlyFee ?? 0),
              passcodeHash: String(x.passcodeHash ?? ''),
              isActive: Boolean(x.isActive),
              createdAtMs: tsToMs(x.createdAt),
              updatedAtMs: tsToMs(x.updatedAt),
            };
          });
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          handlers.onAgents(items);
        },
        handleErr('agents')
      )
    );
  }

  const qParents = buildWorkspaceQuery('parents', user);
  if (qParents) {
    unsubs.push(
      onSnapshot(
        qParents,
        (snap) => {
          const items: ParentProfile[] = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: String(x.id ?? d.id),
              workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
              ownerUid: String(x.ownerUid ?? user.uid),
              name: String(x.name ?? ''),
              contact: String(x.contact ?? ''),
              passcodeHash: String(x.passcodeHash ?? ''),
              createdByAgentId: String(x.createdByAgentId ?? ''),
              createdAtMs: tsToMs(x.createdAt),
              updatedAtMs: tsToMs(x.updatedAt),
            };
          });
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          handlers.onParents(items);
        },
        handleErr('parents')
      )
    );
  }

  const qChildren = buildWorkspaceQuery('children', user);
  if (qChildren) {
    unsubs.push(
      onSnapshot(
        qChildren,
        (snap) => {
          const items: ChildProfile[] = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: String(x.id ?? d.id),
              workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
              ownerUid: String(x.ownerUid ?? user.uid),
              parentId: String(x.parentId ?? ''),
              createdByAgentId: String(x.createdByAgentId ?? ''),
              name: String(x.name ?? ''),
              age: Number(x.age ?? 8),
              grade: String(x.grade ?? ''),
              username: String(x.username ?? ''),
              pinHash: String(x.pinHash ?? ''),
              createdAtMs: tsToMs(x.createdAt),
              updatedAtMs: tsToMs(x.updatedAt),
            };
          });
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          handlers.onChildren(items);
        },
        handleErr('children')
      )
    );
  }

  const qSubs = buildWorkspaceQuery('subscriptions', user);
  if (qSubs) {
    unsubs.push(
      onSnapshot(
        qSubs,
        (snap) => {
          const items: SubscriptionRecord[] = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: String(x.id ?? d.id),
              workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
              ownerUid: String(x.ownerUid ?? user.uid),
              parentId: String(x.parentId ?? ''),
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
          });
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          handlers.onSubscriptions(items);
        },
        handleErr('subscriptions')
      )
    );
  }

  const qPractice = buildWorkspaceQuery('practiceSessions', user);
  if (qPractice) {
    unsubs.push(
      onSnapshot(
        qPractice,
        (snap) => {
          const items: PracticeSession[] = snap.docs.map((d) => {
            const x = d.data();
            return {
              id: String(x.id ?? d.id),
              workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
              ownerUid: String(x.ownerUid ?? user.uid),
              childId: String(x.childId ?? ''),
              parentId: String(x.parentId ?? ''),
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
          });
          items.sort((a, b) => b.createdAtMs - a.createdAtMs);
          handlers.onPracticeSessions(items);
        },
        handleErr('practiceSessions')
      )
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

// -----------------------------------------------------------------------------
// Cloud Firestore Mutations (strictly synchronized with firebase-blueprint.json)
// -----------------------------------------------------------------------------

export async function cloudCreateAgent(
  user: User,
  agent: AgentProfile
): Promise<void> {
  if (!db) return;
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  try {
    await setDoc(doc(db, 'agents', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
      name: (agent.name.trim() || 'Agent').slice(0, 80),
      phone: (agent.phone.trim() || '000').slice(0, 40),
      email: agent.email.trim().slice(0, 120),
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
  if (!db) return;
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  try {
    await updateDoc(doc(db, 'agents', id), {
      agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
      name: (agent.name.trim() || 'Agent').slice(0, 80),
      phone: (agent.phone.trim() || '000').slice(0, 40),
      email: agent.email.trim().slice(0, 120),
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
  if (!db) return;
  const id = sanitizeId(parent.id, 'par');
  const path = `parents/${id}`;
  try {
    await setDoc(doc(db, 'parents', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      name: (parent.name.trim() || 'Parent').slice(0, 80),
      contact: (parent.contact.trim() || '000').slice(0, 120),
      passcodeHash: sanitizeHash(parent.passcodeHash),
      createdByAgentId: sanitizeId(parent.createdByAgentId, 'ag'),
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
  if (!db) return;
  const id = sanitizeId(child.id, 'ch');
  const path = `children/${id}`;
  try {
    await setDoc(doc(db, 'children', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(child.parentId, 'par'),
      createdByAgentId: sanitizeId(child.createdByAgentId, 'ag'),
      name: (child.name.trim() || 'Student').slice(0, 60),
      age: Math.round(clamp(child.age, 3, 20)),
      grade: (child.grade.trim() || 'Grade 3').slice(0, 30),
      username: sanitizeUsername(child.username, id.slice(0, 12)),
      pinHash: sanitizeHash(child.pinHash),
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
  if (!db) return;
  const id = sanitizeId(sub.id, 'sub');
  const path = `subscriptions/${id}`;
  try {
    await setDoc(doc(db, 'subscriptions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(sub.parentId, 'par'),
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
  if (!db) return;
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
  if (!db) return;
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
      mode,
      difficulty,
      sessionType,
      durationSec: sessionType === 'sprint' ? Math.round(clamp(session.durationSec, 0, 3600)) : 0,
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
