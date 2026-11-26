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
  AgentApprovalStatus,
  AgentProfile,
  AppGlobalConfig,
  BOOTSTRAPPED_ADMIN_EMAIL,
  ChildLeaderboardEntry,
  ChildProfile,
  DEFAULT_APP_CONFIG,
  OfflineVoucher,
  ParentProfile,
  PaymentMethod,
  PayoutRequest,
  PracticeSession,
  ReferralCodePublic,
  RoleSession,
  StudentPaymentMethod,
  StudentSubscription,
  SubscriptionRecord,
  SubscriptionStatus,
  TrialLead,
  WORKSPACE_ID,
  WeakTopic,
  getAgentApprovalStatus,
  todayIsoDate,
} from '../types/platform';
import {
  ArithmeticMode,
  Difficulty,
  SessionType,
  normalizeIndianClass,
} from '../types/math';
import {
  hashContactForAttribution,
  isPhoneAgentAuthEmail,
  isPhoneParentAuthEmail,
  normalizeEmailForMatch,
  normalizePhoneForMatch,
} from '../utils/referral';
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
  return todayIsoDate();
}

function sanitizeHash(raw: string): string {
  const trimmed = raw.trim().slice(0, 128);
  return trimmed.length >= 16 ? trimmed : trimmed.padEnd(16, '0');
}

function mapAgentDoc(id: string, x: DocumentData, fallbackUid: string): AgentProfile {
  const approvalStatus = getAgentApprovalStatus({
    isActive: Boolean(x.isActive),
    approvalStatus: x.approvalStatus as AgentApprovalStatus | undefined,
  });
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    agentCode: String(x.agentCode ?? ''),
    name: String(x.name ?? ''),
    phone: String(x.phone ?? ''),
    email: sanitizeEmail(String(x.email ?? '')),
    assignedArea: String(x.assignedArea ?? ''),
    city: typeof x.city === 'string' ? x.city : undefined,
    upiId: typeof x.upiId === 'string' ? x.upiId : undefined,
    approvalStatus,
    commissionRate: Number(x.commissionRate ?? 0),
    commissionPerConversion:
      x.commissionPerConversion !== undefined
        ? Number(x.commissionPerConversion)
        : undefined,
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
    phoneAuthEmail:
      typeof x.phoneAuthEmail === 'string'
        ? sanitizeEmail(x.phoneAuthEmail)
        : undefined,
    passwordAuthEnabled:
      typeof x.passwordAuthEnabled === 'boolean'
        ? x.passwordAuthEnabled
        : undefined,
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
    parentPhoneEmail:
      typeof x.parentPhoneEmail === 'string'
        ? sanitizeEmail(x.parentPhoneEmail)
        : undefined,
    passwordAuthEnabled:
      typeof x.passwordAuthEnabled === 'boolean'
        ? x.passwordAuthEnabled
        : undefined,
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
    parentPhoneEmail:
      typeof x.parentPhoneEmail === 'string'
        ? sanitizeEmail(x.parentPhoneEmail)
        : undefined,
    passwordAuthEnabled:
      typeof x.passwordAuthEnabled === 'boolean'
        ? x.passwordAuthEnabled
        : undefined,
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
    parentPhoneEmail:
      typeof x.parentPhoneEmail === 'string'
        ? sanitizeEmail(x.parentPhoneEmail)
        : undefined,
    passwordAuthEnabled:
      typeof x.passwordAuthEnabled === 'boolean'
        ? x.passwordAuthEnabled
        : undefined,
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
    isHidden: Boolean(x.isHidden),
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapLeadDoc(id: string, x: DocumentData, fallbackUid: string): TrialLead {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    name: String(x.name ?? ''),
    email: sanitizeEmail(String(x.email ?? '')),
    phone: String(x.phone ?? ''),
    referralCode: String(x.referralCode ?? ''),
    agentId: String(x.agentId ?? ''),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    status: x.status === 'converted' ? 'converted' : 'trial',
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapStudentSubDoc(
  id: string,
  x: DocumentData,
  fallbackUid: string
): StudentSubscription {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    subscriberName: String(x.subscriberName ?? 'Student'),
    subscriberEmail: sanitizeEmail(String(x.subscriberEmail ?? '')),
    subscriberPhone: String(x.subscriberPhone ?? ''),
    planType: 'yearly',
    startDate: String(x.startDate ?? ''),
    expiryDate: String(x.expiryDate ?? ''),
    amountPaid: Number(x.amountPaid ?? 0),
    discountApplied: Number(x.discountApplied ?? 0),
    paymentMethod: (x.paymentMethod as StudentPaymentMethod) ?? 'upi',
    referralCode: String(x.referralCode ?? ''),
    attributedAgentId: String(x.attributedAgentId ?? ''),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    voucherCode: String(x.voucherCode ?? ''),
    commissionAmount: Number(x.commissionAmount ?? 0),
    status: (x.status as SubscriptionStatus) ?? 'active',
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

function mapPayoutDoc(
  id: string,
  x: DocumentData,
  fallbackUid: string
): PayoutRequest {
  return {
    id: String(x.id ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    agentId: String(x.agentId ?? ''),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    agentName: String(x.agentName ?? ''),
    upiId: String(x.upiId ?? ''),
    amount: Number(x.amount ?? 0),
    status: x.status === 'paid' ? 'paid' : 'pending',
    utrNumber: String(x.utrNumber ?? ''),
    createdAtMs: tsToMs(x.createdAt),
    updatedAtMs: tsToMs(x.updatedAt),
    paidAt: String(x.paidAt ?? ''),
  };
}

function mapVoucherDoc(
  id: string,
  x: DocumentData,
  fallbackUid: string
): OfflineVoucher {
  return {
    id: String(x.id ?? id),
    code: String(x.code ?? id),
    workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
    ownerUid: String(x.ownerUid ?? fallbackUid),
    agentId: String(x.agentId ?? ''),
    agentEmail: sanitizeEmail(String(x.agentEmail ?? '')),
    agentName: String(x.agentName ?? ''),
    planAmount: Number(x.planAmount ?? 1200),
    status: x.status === 'redeemed' ? 'redeemed' : 'unused',
    redeemedByUid: String(x.redeemedByUid ?? ''),
    redeemedByEmail: sanitizeEmail(String(x.redeemedByEmail ?? '')),
    createdAtMs: tsToMs(x.createdAt),
    redeemedAt: String(x.redeemedAt ?? ''),
  };
}

function mapAppConfigDoc(x: DocumentData): AppGlobalConfig {
  return {
    id: String(x.id ?? 'global'),
    dailyChallengeSeed:
      typeof x.dailyChallengeSeed === 'string' && x.dailyChallengeSeed.trim()
        ? x.dailyChallengeSeed.trim()
        : DEFAULT_APP_CONFIG.dailyChallengeSeed,
    announcementEnabled: Boolean(x.announcementEnabled),
    announcementText:
      typeof x.announcementText === 'string' ? x.announcementText : '',
    updatedAtMs: tsToMs(x.updatedAt),
  };
}

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

function isTrustedAgentEmail(user: User, emailLower: string): boolean {
  return Boolean(
    emailLower.length >= 3 &&
      (user.emailVerified || isPhoneAgentAuthEmail(emailLower))
  );
}

function isEmailPasswordParent(user: User, emailLower: string): boolean {
  return Boolean(
    emailLower.length >= 3 &&
      !user.emailVerified &&
      !isPhoneAgentAuthEmail(emailLower) &&
      !isPhoneParentAuthEmail(emailLower)
  );
}

export async function resolveUserRoleFromFirestore(
  user: User
): Promise<ResolvedFirestoreRole> {
  if (!db) return { session: null, route: '/' };
  const firestore = db;

  const emailLower = sanitizeEmail(user.email ?? '');

  // 1. Bootstrapped Platform Admin (strictly requires verified Google email)
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

  // 2. Explicit /admins/{uid} doc (strictly requires verified Google email)
  if (user.emailVerified) {
    try {
      const adminSnap = await getDoc(doc(firestore, 'admins', user.uid));
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
  }

  if (emailLower.length < 3) {
    return { session: null, route: '/' };
  }

  const phoneParent = isPhoneParentAuthEmail(emailLower);
  const trustedAgent = isTrustedAgentEmail(user, emailLower);

  // 3. Field / Sales Agent matched by verified Google email or phone-auth identity
  if (trustedAgent) {
    try {
      const agentSnap = await getDocs(
        query(collection(firestore, 'agents'), where('email', '==', emailLower), limit(5))
      );
      if (!agentSnap.empty) {
        const matchedAgents = agentSnap.docs.map((d) =>
          mapAgentDoc(d.id, d.data(), user.uid)
        );
        const preferredAgent =
          matchedAgents.find((a) => getAgentApprovalStatus(a) === 'approved') ??
          matchedAgents.find((a) => getAgentApprovalStatus(a) === 'pending') ??
          matchedAgents[0];

        const status = getAgentApprovalStatus(preferredAgent);
        if (status === 'suspended') {
          return { session: null, route: '/', inactiveAgent: true };
        }
        return {
          session: {
            role: 'agent',
            accountId: preferredAgent.id,
            displayName: preferredAgent.name,
          },
          route: '/agent',
        };
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'agents');
    }
  }

  // 4. Parent matched by verified Google email, mobile auth email, or provisioned email+password
  try {
    const parentQuery = phoneParent
      ? query(
          collection(firestore, 'parents'),
          where('phoneAuthEmail', '==', emailLower),
          limit(5)
        )
      : user.emailVerified
      ? query(
          collection(firestore, 'parents'),
          where('email', '==', emailLower),
          limit(5)
        )
      : query(
          collection(firestore, 'parents'),
          where('email', '==', emailLower),
          where('passwordAuthEnabled', '==', true),
          limit(5)
        );

    const parentSnap = await getDocs(parentQuery);
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
    onLeads: (items: TrialLead[]) => void;
    onStudentSubscriptions: (items: StudentSubscription[]) => void;
    onPayoutRequests: (items: PayoutRequest[]) => void;
    onVouchers: (items: OfflineVoucher[]) => void;
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
  const trustedAgent = isTrustedAgentEmail(user, emailLower);
  const phoneParent = isPhoneParentAuthEmail(emailLower);
  const emailPasswordParent = isEmailPasswordParent(user, emailLower);

  let settledCollections = 0;
  const markCollectionSettled = () => {
    settledCollections += 1;
    if (settledCollections >= 9) {
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
      : trustedAgent
      ? [
          {
            key: 'owner',
            path: 'agents',
            q: query(
              collection(firestore, 'agents'),
              where('ownerUid', '==', user.uid),
              limit(250)
            ),
          },
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
      : [];

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
          ...(trustedAgent
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
              ]
            : []),
          ...(user.emailVerified
            ? [
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
          ...(phoneParent
            ? [
                {
                  key: 'parentPhoneEmail',
                  path: 'parents',
                  q: query(
                    collection(firestore, 'parents'),
                    where('phoneAuthEmail', '==', emailLower),
                    limit(25)
                  ),
                },
              ]
            : []),
          ...(emailPasswordParent
            ? [
                {
                  key: 'parentPwdEmail',
                  path: 'parents',
                  q: query(
                    collection(firestore, 'parents'),
                    where('email', '==', emailLower),
                    where('passwordAuthEnabled', '==', true),
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
          ...(trustedAgent
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
              ]
            : []),
          ...(user.emailVerified
            ? [
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
          ...(phoneParent
            ? [
                {
                  key: 'parentPhoneEmail',
                  path: colName,
                  q: query(
                    collection(firestore, colName),
                    where('parentPhoneEmail', '==', emailLower),
                    limit(250)
                  ),
                },
              ]
            : []),
          ...(emailPasswordParent
            ? [
                {
                  key: 'parentPwdEmail',
                  path: colName,
                  q: query(
                    collection(firestore, colName),
                    where('parentEmail', '==', emailLower),
                    where('passwordAuthEnabled', '==', true),
                    limit(250)
                  ),
                },
              ]
            : []),
        ];

  const buildAgentOwnerQueries = (colName: 'leads' | 'payoutRequests') =>
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
          ...(trustedAgent
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
              ]
            : []),
        ];

  const studentSubQueries: Array<{ key: string; q: Query<DocumentData>; path: string }> =
    isBootstrappedAdmin
      ? [
          {
            key: 'ws',
            path: 'studentSubscriptions',
            q: query(
              collection(firestore, 'studentSubscriptions'),
              where('workspaceId', '==', WORKSPACE_ID),
              limit(250)
            ),
          },
        ]
      : [
          {
            key: 'owner',
            path: 'studentSubscriptions',
            q: query(
              collection(firestore, 'studentSubscriptions'),
              where('ownerUid', '==', user.uid),
              limit(100)
            ),
          },
          ...(user.emailVerified
            ? [
                {
                  key: 'subEmail',
                  path: 'studentSubscriptions',
                  q: query(
                    collection(firestore, 'studentSubscriptions'),
                    where('subscriberEmail', '==', emailLower),
                    limit(100)
                  ),
                },
              ]
            : []),
          ...(trustedAgent
            ? [
                {
                  key: 'agentEmail',
                  path: 'studentSubscriptions',
                  q: query(
                    collection(firestore, 'studentSubscriptions'),
                    where('agentEmail', '==', emailLower),
                    limit(250)
                  ),
                },
              ]
            : []),
        ];

  const voucherQueries: Array<{ key: string; q: Query<DocumentData>; path: string }> =
    isBootstrappedAdmin
      ? [
          {
            key: 'ws',
            path: 'vouchers',
            q: query(
              collection(firestore, 'vouchers'),
              where('workspaceId', '==', WORKSPACE_ID),
              limit(250)
            ),
          },
        ]
      : trustedAgent
      ? [
          {
            key: 'agentEmail',
            path: 'vouchers',
            q: query(
              collection(firestore, 'vouchers'),
              where('agentEmail', '==', emailLower),
              limit(100)
            ),
          },
        ]
      : [];

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
    subscribeMergedQueries(
      buildAgentOwnerQueries('leads'),
      (id, data) => mapLeadDoc(id, data, user.uid),
      handlers.onLeads,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      studentSubQueries,
      (id, data) => mapStudentSubDoc(id, data, user.uid),
      handlers.onStudentSubscriptions,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      buildAgentOwnerQueries('payoutRequests'),
      (id, data) => mapPayoutDoc(id, data, user.uid),
      handlers.onPayoutRequests,
      handlers.onError,
      markCollectionSettled
    ),
    subscribeMergedQueries(
      voucherQueries,
      (id, data) => mapVoucherDoc(id, data, user.uid),
      handlers.onVouchers,
      handlers.onError,
      markCollectionSettled
    ),
  ];

  return () => {
    for (const u of unsubs) u();
  };
}

// -----------------------------------------------------------------------------
// Public Real-Time Listeners (Child Champions & AppGlobalConfig)
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
  const firestore = db;

  const q = query(
    collection(firestore, 'childLeaderboard'),
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

export function subscribeAppConfig(
  onConfig: (config: AppGlobalConfig) => void
): Unsubscribe {
  if (!db) {
    onConfig(DEFAULT_APP_CONFIG);
    return () => {};
  }
  const firestore = db;
  return onSnapshot(
    doc(firestore, 'appConfig', 'global'),
    (snap) => {
      if (snap.exists()) {
        onConfig(mapAppConfigDoc(snap.data()));
      } else {
        onConfig(DEFAULT_APP_CONFIG);
      }
    },
    () => {
      onConfig(DEFAULT_APP_CONFIG);
    }
  );
}

// -----------------------------------------------------------------------------
// Referral Directory Sync & Zero-PII Lookup
// -----------------------------------------------------------------------------

async function cloudSyncReferralCode(agent: AgentProfile): Promise<void> {
  if (!db) return;
  const firestore = db;
  const code = sanitizeCode(agent.agentCode.toUpperCase(), agent.id.slice(0, 12));
  const [emailHash, phoneHash] = await Promise.all([
    hashContactForAttribution(normalizeEmailForMatch(agent.email)),
    hashContactForAttribution(normalizePhoneForMatch(agent.phone)),
  ]);
  const approvalStatus = getAgentApprovalStatus(agent);
  const path = `referralCodes/${code}`;
  try {
    await setDoc(doc(firestore, 'referralCodes', code), {
      code,
      workspaceId: WORKSPACE_ID,
      agentId: sanitizeId(agent.id, 'ag'),
      agentName: (agent.name.trim() || 'Sales Partner').slice(0, 80),
      isActive: Boolean(agent.isActive),
      approvalStatus,
      emailHash,
      phoneHash,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function lookupReferralCodeCloud(
  rawCode: string
): Promise<ReferralCodePublic | null> {
  if (!db) return null;
  const firestore = db;
  const code = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
  if (code.length < 2) return null;
  try {
    const snap = await getDoc(doc(firestore, 'referralCodes', code));
    if (!snap.exists()) return null;
    const x = snap.data();
    return {
      code: String(x.code ?? code),
      workspaceId: String(x.workspaceId ?? WORKSPACE_ID),
      agentId: String(x.agentId ?? ''),
      agentName: String(x.agentName ?? 'Partner'),
      isActive: Boolean(x.isActive),
      approvalStatus: (x.approvalStatus as AgentApprovalStatus) ?? 'approved',
      emailHash: String(x.emailHash ?? ''),
      phoneHash: String(x.phoneHash ?? ''),
      updatedAtMs: tsToMs(x.updatedAt),
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Cloud Firestore Mutations
// -----------------------------------------------------------------------------

export async function cloudCreateAgent(
  user: User,
  agent: AgentProfile
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  const email = sanitizeEmail(agent.email);
  if (email.length < 3) {
    throw new Error('Agent login identifier is required for cross-device sync.');
  }
  const approvalStatus = getAgentApprovalStatus(agent);
  const payload: Record<string, unknown> = {
    id,
    workspaceId: WORKSPACE_ID,
    ownerUid: sanitizeId(agent.ownerUid || user.uid, 'u'),
    agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
    name: (agent.name.trim() || 'Agent').slice(0, 80),
    phone: (agent.phone.trim() || '000').slice(0, 40),
    email,
    assignedArea: (agent.assignedArea.trim() || 'General').slice(0, 80),
    city: (agent.city ?? agent.assignedArea).trim().slice(0, 80),
    upiId: (agent.upiId ?? '').trim().slice(0, 100),
    approvalStatus,
    commissionRate: clamp(agent.commissionRate, 0, 100),
    commissionPerConversion: clamp(agent.commissionPerConversion ?? 0, 0, 10000),
    defaultYearlyFee: clamp(agent.defaultYearlyFee, 0, 1000000),
    passcodeHash: sanitizeHash(agent.passcodeHash),
    isActive: Boolean(agent.isActive),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(firestore, 'agents', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  await cloudSyncReferralCode({
    ...agent,
    id,
    email,
    approvalStatus,
  });
}

export async function cloudUpdateAgent(agent: AgentProfile): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  const email = sanitizeEmail(agent.email);
  if (email.length < 3) {
    throw new Error('Agent email is required for cross-device Google Sign-In.');
  }
  const approvalStatus = getAgentApprovalStatus(agent);
  try {
    await updateDoc(doc(firestore, 'agents', id), {
      agentCode: sanitizeCode(agent.agentCode, id.slice(0, 12)),
      name: (agent.name.trim() || 'Agent').slice(0, 80),
      phone: (agent.phone.trim() || '000').slice(0, 40),
      email,
      assignedArea: (agent.assignedArea.trim() || 'General').slice(0, 80),
      city: (agent.city ?? agent.assignedArea).trim().slice(0, 80),
      upiId: (agent.upiId ?? '').trim().slice(0, 100),
      approvalStatus,
      commissionRate: clamp(agent.commissionRate, 0, 100),
      commissionPerConversion: clamp(agent.commissionPerConversion ?? 0, 0, 10000),
      defaultYearlyFee: clamp(agent.defaultYearlyFee, 0, 1000000),
      passcodeHash: sanitizeHash(agent.passcodeHash),
      isActive: Boolean(agent.isActive),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
  await cloudSyncReferralCode({
    ...agent,
    id,
    email,
    approvalStatus,
  });
}

export async function cloudUpdateAgentSelfProfile(
  agent: AgentProfile,
  patch: { name: string; phone: string; city: string; upiId: string }
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(agent.id, 'ag');
  const path = `agents/${id}`;
  try {
    await updateDoc(doc(firestore, 'agents', id), {
      name: (patch.name.trim() || agent.name).slice(0, 80),
      phone: (patch.phone.trim() || agent.phone).slice(0, 40),
      city: patch.city.trim().slice(0, 80),
      assignedArea: (patch.city.trim() || agent.assignedArea).slice(0, 80),
      upiId: patch.upiId.trim().slice(0, 100),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudUpdateAgentPasswordHash(
  agentId: string,
  passcodeHash: string
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(agentId, 'ag');
  const path = `agents/${id}`;
  try {
    await updateDoc(doc(firestore, 'agents', id), {
      passcodeHash: sanitizeHash(passcodeHash),
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
  const firestore = db;
  const id = sanitizeId(parent.id, 'par');
  const path = `parents/${id}`;
  try {
    await setDoc(doc(firestore, 'parents', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      name: (parent.name.trim() || 'Parent').slice(0, 80),
      contact: (parent.contact.trim() || '000').slice(0, 120),
      email: sanitizeEmail(parent.email),
      phoneAuthEmail: sanitizeEmail(parent.phoneAuthEmail ?? ''),
      passwordAuthEnabled: Boolean(parent.passwordAuthEnabled),
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

export async function cloudUpdateParentPasswordHash(
  parentId: string,
  passcodeHash: string
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(parentId, 'par');
  const path = `parents/${id}`;
  try {
    await updateDoc(doc(firestore, 'parents', id), {
      passcodeHash: sanitizeHash(passcodeHash),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cloudUpdateParentByAdmin(params: {
  parentId: string;
  name: string;
  contact: string;
  email: string;
  phoneAuthEmail: string;
  passwordAuthEnabled: boolean;
  passcodeHash: string;
  linkedChildIds: string[];
  linkedSubIds: string[];
}): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(params.parentId, 'par');
  const parentEmail = sanitizeEmail(params.email);
  const parentPhoneEmail = sanitizeEmail(params.phoneAuthEmail);
  const passwordAuthEnabled = Boolean(params.passwordAuthEnabled);

  try {
    await updateDoc(doc(firestore, 'parents', id), {
      name: (params.name.trim() || 'Parent').slice(0, 80),
      contact: (params.contact.trim() || '000').slice(0, 120),
      email: parentEmail,
      phoneAuthEmail: parentPhoneEmail,
      passwordAuthEnabled,
      passcodeHash: sanitizeHash(params.passcodeHash),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `parents/${id}`);
  }

  await Promise.all([
    ...params.linkedChildIds.map(async (rawChildId) => {
      const chId = sanitizeId(rawChildId, 'ch');
      try {
        await updateDoc(doc(firestore, 'children', chId), {
          parentEmail,
          parentPhoneEmail,
          passwordAuthEnabled,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `children/${chId}`);
      }
    }),
    ...params.linkedSubIds.map(async (rawSubId) => {
      const subId = sanitizeId(rawSubId, 'sub');
      try {
        await updateDoc(doc(firestore, 'subscriptions', subId), {
          parentEmail,
          parentPhoneEmail,
          passwordAuthEnabled,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${subId}`);
      }
    }),
  ]);
}

export async function cloudCreateChild(
  user: User,
  child: ChildProfile
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(child.id, 'ch');
  const path = `children/${id}`;
  try {
    await setDoc(doc(firestore, 'children', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(child.parentId, 'par'),
      createdByAgentId: sanitizeId(child.createdByAgentId, 'ag'),
      parentEmail: sanitizeEmail(child.parentEmail),
      parentPhoneEmail: sanitizeEmail(child.parentPhoneEmail ?? ''),
      passwordAuthEnabled: Boolean(child.passwordAuthEnabled),
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

export async function cloudUpdateChildByAdmin(
  childId: string,
  name: string,
  grade: string
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(childId, 'ch');
  const cleanName = (name.trim() || 'Student').slice(0, 60);
  const safeGrade = normalizeIndianClass(grade);

  try {
    await updateDoc(doc(firestore, 'children', id), {
      name: cleanName,
      grade: safeGrade,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `children/${id}`);
  }

  const lbRef = doc(firestore, 'childLeaderboard', id);
  try {
    const snap = await getDoc(lbRef);
    if (snap.exists()) {
      await updateDoc(lbRef, {
        name: cleanName,
        grade: safeGrade,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `childLeaderboard/${id}`);
  }
}

export async function cloudCreateSubscription(
  user: User,
  sub: SubscriptionRecord
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(sub.id, 'sub');
  const path = `subscriptions/${id}`;
  try {
    await setDoc(doc(firestore, 'subscriptions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      parentId: sanitizeId(sub.parentId, 'par'),
      parentEmail: sanitizeEmail(sub.parentEmail),
      parentPhoneEmail: sanitizeEmail(sub.parentPhoneEmail ?? ''),
      passwordAuthEnabled: Boolean(sub.passwordAuthEnabled),
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
  const firestore = db;
  const id = sanitizeId(sub.id, 'sub');
  const path = `subscriptions/${id}`;
  try {
    await updateDoc(doc(firestore, 'subscriptions', id), {
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
  const firestore = db;
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
    await setDoc(doc(firestore, 'practiceSessions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      childId: sanitizeId(session.childId, 'ch'),
      parentId: sanitizeId(session.parentId, 'par'),
      parentEmail: sanitizeEmail(session.parentEmail),
      parentPhoneEmail: sanitizeEmail(session.parentPhoneEmail ?? ''),
      passwordAuthEnabled: Boolean(session.passwordAuthEnabled),
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
  const firestore = db;
  const childId = sanitizeId(child.id, 'ch');
  const safeTotalScore = Math.round(clamp(nextTotalScore, 0, 10000000));
  const safeSessionsCount = Math.round(clamp(nextSessionsCount, 0, 1000000));
  const safeBestStreak = Math.round(clamp(nextBestStreak, 0, 10000));
  const safeGrade = normalizeIndianClass(child.grade);
  const safeName = (child.name.trim() || 'Student').slice(0, 60);

  try {
    await updateDoc(doc(firestore, 'children', childId), {
      totalScore: safeTotalScore,
      sessionsCount: safeSessionsCount,
      bestStreak: safeBestStreak,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `children/${childId}`);
  }

  if (safeTotalScore < 1) return;

  const lbRef = doc(firestore, 'childLeaderboard', childId);
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
        isHidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, lbPath);
    }
  }
}

export async function cloudUpdateChildLeaderboardVisibility(
  childId: string,
  isHidden: boolean
): Promise<void> {
  if (!db) return;
  const firestore = db;
  const safeId = sanitizeId(childId, 'ch');
  try {
    await updateDoc(doc(firestore, 'childLeaderboard', safeId), {
      isHidden,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `childLeaderboard/${safeId}`);
  }
}

// -----------------------------------------------------------------------------
// Growth, Leads, Student Subscriptions, Payouts, Vouchers, AppConfig
// -----------------------------------------------------------------------------

export async function cloudCreateTrialLead(
  user: User,
  lead: TrialLead
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(lead.id, 'lead');
  try {
    await setDoc(doc(firestore, 'leads', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      name: (lead.name.trim() || 'Student').slice(0, 80),
      email: sanitizeEmail(lead.email),
      phone: lead.phone.trim().slice(0, 40),
      referralCode: sanitizeCode(lead.referralCode, 'REF'),
      agentId: sanitizeId(lead.agentId, 'ag'),
      agentEmail: sanitizeEmail(lead.agentEmail),
      status: lead.status === 'converted' ? 'converted' : 'trial',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `leads/${id}`);
  }
}

export async function cloudUpdateLeadStatus(
  leadId: string,
  status: 'trial' | 'converted'
): Promise<void> {
  if (!db) return;
  const firestore = db;
  const id = sanitizeId(leadId, 'lead');
  try {
    await updateDoc(doc(firestore, 'leads', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${id}`);
  }
}

export async function cloudCreateStudentSubscription(
  user: User,
  sub: StudentSubscription
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(sub.id, 'ss');
  try {
    await setDoc(doc(firestore, 'studentSubscriptions', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      subscriberName: (sub.subscriberName.trim() || 'Student').slice(0, 80),
      subscriberEmail: sanitizeEmail(sub.subscriberEmail),
      subscriberPhone: sub.subscriberPhone.trim().slice(0, 40),
      planType: 'yearly',
      startDate: sanitizeDate(sub.startDate),
      expiryDate: sanitizeDate(sub.expiryDate),
      amountPaid: clamp(sub.amountPaid, 0, 100000),
      discountApplied: clamp(sub.discountApplied, 0, 10000),
      paymentMethod: ['upi', 'card', 'voucher'].includes(sub.paymentMethod)
        ? sub.paymentMethod
        : 'upi',
      referralCode: sub.referralCode.trim().toUpperCase().slice(0, 32),
      attributedAgentId: sub.attributedAgentId.trim().slice(0, 128),
      agentEmail: sanitizeEmail(sub.agentEmail),
      voucherCode: sub.voucherCode.trim().toUpperCase().slice(0, 64),
      commissionAmount: clamp(sub.commissionAmount, 0, 10000),
      status: ['active', 'expired', 'suspended'].includes(sub.status)
        ? sub.status
        : 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.CREATE,
      `studentSubscriptions/${id}`
    );
  }
}

export async function cloudCreatePayoutRequest(
  user: User,
  payout: PayoutRequest
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(payout.id, 'pay');
  try {
    await setDoc(doc(firestore, 'payoutRequests', id), {
      id,
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      agentId: sanitizeId(payout.agentId, 'ag'),
      agentEmail: sanitizeEmail(payout.agentEmail),
      agentName: (payout.agentName.trim() || 'Agent').slice(0, 80),
      upiId: payout.upiId.trim().slice(0, 100),
      amount: clamp(payout.amount, 500, 1000000),
      status: 'pending',
      utrNumber: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      paidAt: '',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `payoutRequests/${id}`);
  }
}

export async function cloudMarkPayoutPaid(
  payoutId: string,
  utrNumber: string,
  paidAt: string
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(payoutId, 'pay');
  try {
    await updateDoc(doc(firestore, 'payoutRequests', id), {
      status: 'paid',
      utrNumber: utrNumber.trim().slice(0, 80),
      paidAt: paidAt.trim().slice(0, 32),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payoutRequests/${id}`);
  }
}

export async function cloudCreateOfflineVoucher(
  user: User,
  voucher: OfflineVoucher
): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const id = sanitizeId(voucher.id, 'GMATHS');
  try {
    await setDoc(doc(firestore, 'vouchers', id), {
      id,
      code: voucher.code.trim().toUpperCase().slice(0, 64),
      workspaceId: WORKSPACE_ID,
      ownerUid: sanitizeId(user.uid, 'u'),
      agentId: voucher.agentId.trim().slice(0, 128),
      agentEmail: sanitizeEmail(voucher.agentEmail),
      agentName: voucher.agentName.trim().slice(0, 80),
      planAmount: clamp(voucher.planAmount, 0, 100000),
      status: 'unused',
      redeemedByUid: '',
      redeemedByEmail: '',
      createdAt: serverTimestamp(),
      redeemedAt: '',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `vouchers/${id}`);
  }
}

export async function cloudLookupAndRedeemVoucher(
  user: User,
  rawCode: string
): Promise<OfflineVoucher> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  const codeClean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '');
  if (codeClean.length < 4) {
    throw new Error('Enter a valid activation voucher code.');
  }
  const ref = doc(firestore, 'vouchers', codeClean);
  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `vouchers/${codeClean}`);
  }
  if (!snap || !snap.exists()) {
    throw new Error('Voucher code not found. Verify spelling and try again.');
  }
  const existing = mapVoucherDoc(snap.id, snap.data(), user.uid);
  if (existing.status === 'redeemed') {
    throw new Error('This offline voucher code has already been redeemed.');
  }

  const redeemedAt = todayIsoDate();
  const redeemedEmail = sanitizeEmail(user.email ?? '');
  try {
    await updateDoc(ref, {
      status: 'redeemed',
      redeemedByUid: sanitizeId(user.uid, 'u'),
      redeemedByEmail: redeemedEmail,
      redeemedAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `vouchers/${codeClean}`);
  }
  return {
    ...existing,
    status: 'redeemed',
    redeemedByUid: user.uid,
    redeemedByEmail: redeemedEmail,
    redeemedAt,
  };
}

export async function cloudSaveAppConfig(config: {
  dailyChallengeSeed: string;
  announcementEnabled: boolean;
  announcementText: string;
}): Promise<void> {
  if (!db) throw new Error('Cloud Firestore is not initialized.');
  const firestore = db;
  try {
    await setDoc(doc(firestore, 'appConfig', 'global'), {
      id: 'global',
      dailyChallengeSeed:
        config.dailyChallengeSeed.trim().slice(0, 64) ||
        DEFAULT_APP_CONFIG.dailyChallengeSeed,
      announcementEnabled: Boolean(config.announcementEnabled),
      announcementText: config.announcementText.trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'appConfig/global');
  }
}
