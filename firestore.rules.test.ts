import assert from 'node:assert/strict';

type AuthContext = {
  uid: string;
  email: string;
  email_verified: boolean;
} | null;

const INDIAN_CLASSES = new Set([
  'Nursery', 'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
]);

const SERVER_TIME = 1770000000000;
const BOOTSTRAPPED_ADMIN = 'kumarnishchhal175@gmail.com';

const dbState: Record<string, Record<string, Record<string, unknown>>> = {
  admins: {},
  agents: {
    ag_1: {
      id: 'ag_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'admin_uid',
      agentCode: 'AG01',
      name: 'Field Agent One',
      phone: '9876543210',
      email: 'agent1@example.com',
      assignedArea: 'North Zone',
      commissionRate: 15,
      defaultYearlyFee: 1200,
      passcodeHash: 'a'.repeat(64),
      isActive: true,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
  parents: {
    par_1: {
      id: 'par_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'agent_uid',
      name: 'Parent One',
      contact: 'parent1@example.com',
      email: 'parent1@example.com',
      passcodeHash: 'b'.repeat(64),
      createdByAgentId: 'ag_1',
      agentEmail: 'agent1@example.com',
      agentName: 'Field Agent One',
      agentPhone: '9876543210',
      agentArea: 'North Zone',
      agentCode: 'AG01',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
  children: {
    ch_1: {
      id: 'ch_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'agent_uid',
      parentId: 'par_1',
      createdByAgentId: 'ag_1',
      parentEmail: 'parent1@example.com',
      agentEmail: 'agent1@example.com',
      name: 'Aarav',
      grade: '3rd',
      totalScore: 42,
      sessionsCount: 3,
      bestStreak: 11,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
  childLeaderboard: {},
  subscriptions: {
    sub_1: {
      id: 'sub_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'agent_uid',
      parentId: 'par_1',
      parentEmail: 'parent1@example.com',
      agentEmail: 'agent1@example.com',
      planType: 'yearly',
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      feeAmount: 1200,
      paymentMethod: 'upi',
      receiptNote: 'Initial yearly payment',
      collectedByAgentId: 'ag_1',
      status: 'active',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
  practiceSessions: {
    ps_1: {
      id: 'ps_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'parent_uid',
      childId: 'ch_1',
      parentId: 'par_1',
      parentEmail: 'parent1@example.com',
      agentEmail: 'agent1@example.com',
      grade: '3rd',
      mode: 'addition',
      difficulty: 'easy',
      sessionType: 'sprint',
      durationSec: 60,
      elapsedSec: 60,
      score: 20,
      attempted: 22,
      correct: 20,
      accuracy: 90.9,
      bestStreak: 8,
      avgResponseMs: 2500,
      qpm: 20,
      allowNegatives: false,
      weakTopic: 'none',
      createdAt: SERVER_TIME,
    },
  },
};

const isVerified = (auth: AuthContext) => Boolean(auth && auth.email_verified);
const isBootstrappedAdmin = (auth: AuthContext) =>
  isVerified(auth) && auth!.email.toLowerCase() === BOOTSTRAPPED_ADMIN;
const isValidId = (id: unknown) =>
  typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
const isValidDate = (d: unknown) =>
  typeof d === 'string' && d.length === 10 && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d);

function hasExactKeys(data: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(data);
  return actual.length === keys.length && keys.every((k) => actual.includes(k));
}

function isFamilyScopedAuthorized(auth: AuthContext, data: Record<string, unknown>): boolean {
  if (!isVerified(auth)) return false;
  const email = auth!.email.toLowerCase();
  return (
    data.ownerUid === auth!.uid ||
    (isBootstrappedAdmin(auth) && data.workspaceId === 'gmaths_main') ||
    (typeof data.agentEmail === 'string' && data.agentEmail.length >= 3 && data.agentEmail === email) ||
    (typeof data.parentEmail === 'string' && data.parentEmail.length >= 3 && data.parentEmail === email)
  );
}

function evaluateRule(
  auth: AuthContext,
  col: string,
  op: 'get' | 'list' | 'create' | 'update',
  docId: string,
  incoming?: Record<string, unknown>
): 'ALLOW' | 'PERMISSION_DENIED' {
  const existing = dbState[col]?.[docId];

  if (col === 'admins' && op === 'create') {
    return isBootstrappedAdmin(auth) && isValidId(docId) ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  if (col === 'agents') {
    if (op === 'get') {
      if (!isVerified(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      if (!existing) return 'ALLOW';
      const ok =
        existing.ownerUid === auth!.uid ||
        (isBootstrappedAdmin(auth) && existing.workspaceId === 'gmaths_main') ||
        existing.email === auth!.email.toLowerCase();
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      const req = [
        'id', 'workspaceId', 'ownerUid', 'agentCode', 'name', 'phone', 'email',
        'assignedArea', 'commissionRate', 'defaultYearlyFee', 'passcodeHash',
        'isActive', 'createdAt', 'updatedAt',
      ];
      const ok =
        isVerified(auth) &&
        isValidId(docId) &&
        hasExactKeys(incoming, req) &&
        incoming.id === docId &&
        typeof incoming.email === 'string' &&
        incoming.email.length >= 3 &&
        (incoming.ownerUid === auth!.uid || isBootstrappedAdmin(auth)) &&
        incoming.createdAt === SERVER_TIME &&
        incoming.updatedAt === SERVER_TIME;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'parents') {
    if (op === 'get') {
      if (!isVerified(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      if (!existing) return 'ALLOW';
      const email = auth!.email.toLowerCase();
      const ok =
        existing.ownerUid === auth!.uid ||
        (isBootstrappedAdmin(auth) && existing.workspaceId === 'gmaths_main') ||
        existing.agentEmail === email ||
        existing.email === email;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      const agentId = String(incoming.createdByAgentId ?? '');
      const ok =
        isVerified(auth) &&
        isValidId(docId) &&
        Boolean(dbState.agents[agentId]);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'children' && op === 'create' && incoming) {
    const req = [
      'id', 'workspaceId', 'ownerUid', 'parentId', 'createdByAgentId',
      'parentEmail', 'agentEmail', 'name', 'grade', 'totalScore',
      'sessionsCount', 'bestStreak', 'createdAt', 'updatedAt',
    ];
    const parentId = String(incoming.parentId ?? '');
    const ok =
      isVerified(auth) &&
      isValidId(docId) &&
      hasExactKeys(incoming, req) &&
      INDIAN_CLASSES.has(String(incoming.grade)) &&
      Boolean(dbState.parents[parentId]) &&
      incoming.createdAt === SERVER_TIME &&
      incoming.updatedAt === SERVER_TIME;
    return ok ? 'ALLOW' : 'PERMISSION_DENIED';
  }

  if (col === 'childLeaderboard') {
    if (op === 'list') {
      return Number(incoming?.totalScore ?? 0) >= 1 ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      const req = [
        'id', 'childId', 'workspaceId', 'ownerUid', 'name', 'grade',
        'totalScore', 'sessionsCount', 'bestStreak', 'isPublic', 'createdAt', 'updatedAt',
      ];
      const childDoc = dbState.children[docId];
      const ok =
        isVerified(auth) &&
        isValidId(docId) &&
        hasExactKeys(incoming, req) &&
        incoming.id === docId &&
        incoming.childId === docId &&
        INDIAN_CLASSES.has(String(incoming.grade)) &&
        Number(incoming.totalScore) >= 1 &&
        incoming.isPublic === true &&
        Boolean(childDoc) &&
        isFamilyScopedAuthorized(auth, childDoc) &&
        incoming.createdAt === SERVER_TIME &&
        incoming.updatedAt === SERVER_TIME;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'subscriptions') {
    if (op === 'create' && incoming) {
      const ok =
        isVerified(auth) &&
        isValidId(docId) &&
        incoming.planType === 'yearly' &&
        isValidDate(incoming.startDate) &&
        isValidDate(incoming.expiryDate) &&
        Boolean(dbState.parents[String(incoming.parentId ?? '')]) &&
        Boolean(dbState.agents[String(incoming.collectedByAgentId ?? '')]);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && incoming && existing) {
      const ok =
        isVerified(auth) &&
        incoming.parentId === existing.parentId &&
        incoming.planType === 'yearly' &&
        isFamilyScopedAuthorized(auth, existing);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'practiceSessions' && op === 'update') {
    return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

const tests: Array<{ name: string; expected: 'ALLOW' | 'PERMISSION_DENIED'; run: () => 'ALLOW' | 'PERMISSION_DENIED' }> = [
  {
    name: 'DD-01 Unverified Admin Email Spoof Blocked',
    expected: 'PERMISSION_DENIED',
    run: () => evaluateRule({ uid: 'spoof', email: BOOTSTRAPPED_ADMIN, email_verified: false }, 'agents', 'get', 'ag_1'),
  },
  {
    name: 'DD-02 Non-Admin Self-Escalation to /admins Blocked',
    expected: 'PERMISSION_DENIED',
    run: () => evaluateRule({ uid: 'u2', email: 'u2@example.com', email_verified: true }, 'admins', 'create', 'u2', { uid: 'u2' }),
  },
  {
    name: 'DD-03 Shadow Ghost Field on Agent Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'admin_uid', email: BOOTSTRAPPED_ADMIN, email_verified: true }, 'agents', 'create', 'ag_bad', {
        ...dbState.agents.ag_1,
        id: 'ag_bad',
        isSuperAdmin: true,
      }),
  },
  {
    name: 'DD-04 Orphaned Parent Without Existing Agent Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'parents', 'create', 'par_bad', {
        ...dbState.parents.par_1,
        id: 'par_bad',
        createdByAgentId: 'missing_agent',
      }),
  },
  {
    name: 'DD-05 Orphaned Child Without Existing Parent Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'children', 'create', 'ch_bad', {
        ...dbState.children.ch_1,
        id: 'ch_bad',
        parentId: 'missing_parent',
      }),
  },
  {
    name: 'DD-06 Legacy Child Username/PIN Credentials Rejected',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'children', 'create', 'ch_cred', {
        ...dbState.children.ch_1,
        id: 'ch_cred',
        username: 'aarav_1',
        pinHash: 'c'.repeat(64),
      }),
  },
  {
    name: 'DD-07 Invalid Non-Indian Class Grade Rejected',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'children', 'create', 'ch_grade', {
        ...dbState.children.ch_1,
        id: 'ch_grade',
        grade: 'Grade 99',
      }),
  },
  {
    name: 'DD-08 Invalid Monthly Subscription Plan Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'subscriptions', 'create', 'sub_bad', {
        ...dbState.subscriptions.sub_1,
        id: 'sub_bad',
        planType: 'monthly',
      }),
  },
  {
    name: 'DD-09 Immutable Subscription parentId Mutation Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'subscriptions', 'update', 'sub_1', {
        ...dbState.subscriptions.sub_1,
        parentId: 'par_other',
      }),
  },
  {
    name: 'DD-10 Practice Session Score Tampering Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'parent_uid', email: 'parent1@example.com', email_verified: true }, 'practiceSessions', 'update', 'ps_1', {
        ...dbState.practiceSessions.ps_1,
        score: 9999,
      }),
  },
  {
    name: 'DD-11 Cross-Tenant Parent PII Read Blocked',
    expected: 'PERMISSION_DENIED',
    run: () => evaluateRule({ uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true }, 'parents', 'get', 'par_1'),
  },
  {
    name: 'DD-12 Public ChildLeaderboard Spoof & PII Injection Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true }, 'childLeaderboard', 'create', 'ch_1', {
        id: 'ch_1',
        childId: 'ch_1',
        workspaceId: 'gmaths_main',
        ownerUid: 'attacker_uid',
        name: 'Aarav',
        grade: '3rd',
        totalScore: 500,
        sessionsCount: 5,
        bestStreak: 15,
        isPublic: true,
        email: 'leak@example.com',
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
  },
  {
    name: 'VALID-01 Parent Reads Own Profile Cross-Device via Verified Email',
    expected: 'ALLOW',
    run: () => evaluateRule({ uid: 'parent_mobile_uid', email: 'parent1@example.com', email_verified: true }, 'parents', 'get', 'par_1'),
  },
  {
    name: 'VALID-02 Parent Updates ChildLeaderboard Entry Without PII',
    expected: 'ALLOW',
    run: () =>
      evaluateRule({ uid: 'parent_mobile_uid', email: 'parent1@example.com', email_verified: true }, 'childLeaderboard', 'create', 'ch_1', {
        id: 'ch_1',
        childId: 'ch_1',
        workspaceId: 'gmaths_main',
        ownerUid: 'parent_mobile_uid',
        name: 'Aarav',
        grade: '3rd',
        totalScore: 42,
        sessionsCount: 3,
        bestStreak: 11,
        isPublic: true,
        createdAt: SERVER_TIME,
        updatedAt: SERVER_TIME,
      }),
  },
  {
    name: 'VALID-03 Public Home Page Lists Top 3 Champions (totalScore >= 1)',
    expected: 'ALLOW',
    run: () => evaluateRule(null, 'childLeaderboard', 'list', '', { totalScore: 42 }),
  },
];

for (const t of tests) {
  const actual = t.run();
  assert.equal(actual, t.expected, `FAILED: ${t.name} (expected ${t.expected}, got ${actual})`);
  console.log(`PASS: ${t.name} -> ${actual}`);
}

console.log(`All ${tests.length} cross-device RBAC & Top 3 Champions security tests passed.`);
