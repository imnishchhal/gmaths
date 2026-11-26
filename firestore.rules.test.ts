import assert from 'node:assert/strict';

type AuthContext = {
  uid: string;
  email: string;
  email_verified: boolean;
  sign_in_provider?: 'google.com' | 'password';
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
      city: 'Delhi',
      upiId: 'agent1@okicici',
      approvalStatus: 'approved',
      commissionRate: 15,
      commissionPerConversion: 300,
      defaultYearlyFee: 1200,
      passcodeHash: 'a'.repeat(64),
      isActive: true,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    ag_pending: {
      id: 'ag_pending',
      workspaceId: 'gmaths_main',
      ownerUid: 'pending_uid',
      agentCode: 'PEND01',
      name: 'Pending Agent',
      phone: '9111122222',
      email: 'pending@example.com',
      assignedArea: 'Pune',
      city: 'Pune',
      upiId: 'pending@upi',
      approvalStatus: 'pending',
      commissionRate: 0,
      commissionPerConversion: 0,
      defaultYearlyFee: 1200,
      passcodeHash: 'p'.repeat(64),
      isActive: false,
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
    ag_phone: {
      id: 'ag_phone',
      workspaceId: 'gmaths_main',
      ownerUid: 'phone_ag_uid',
      agentCode: 'PH01',
      name: 'Phone Agent',
      phone: '9876501234',
      email: 'agent.9876501234@gmaths.local',
      assignedArea: 'Jaipur',
      city: 'Jaipur',
      upiId: 'phone@upi',
      approvalStatus: 'approved',
      commissionRate: 15,
      commissionPerConversion: 300,
      defaultYearlyFee: 1200,
      passcodeHash: 'x'.repeat(64),
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
  leaderboard: {
    lb_1: {
      id: 'lb_1',
      userId: 'parent_uid',
      displayName: 'Speedy',
      mode: 'mixed',
      difficulty: 'medium',
      sessionType: 'sprint',
      durationSec: 60,
      score: 40,
      accuracy: 95,
      bestStreak: 12,
      avgResponseMs: 1200,
      qpm: 40,
      isPublic: true,
      isHidden: false,
      isFlagged: false,
      flagReason: '',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
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
  studentSubscriptions: {
    ss_1: {
      id: 'ss_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'student_uid',
      subscriberName: 'Rohan',
      subscriberEmail: 'rohan@example.com',
      subscriberPhone: '9888877777',
      planType: 'yearly',
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      amountPaid: 1100,
      discountApplied: 100,
      paymentMethod: 'upi',
      referralCode: 'AG01',
      attributedAgentId: 'ag_1',
      agentEmail: 'agent1@example.com',
      voucherCode: '',
      commissionAmount: 300,
      status: 'active',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
    },
  },
  payoutRequests: {
    pay_1: {
      id: 'pay_1',
      workspaceId: 'gmaths_main',
      ownerUid: 'agent_uid',
      agentId: 'ag_1',
      agentEmail: 'agent1@example.com',
      agentName: 'Field Agent One',
      upiId: 'agent1@okicici',
      amount: 600,
      status: 'pending',
      utrNumber: '',
      createdAt: SERVER_TIME,
      updatedAt: SERVER_TIME,
      paidAt: '',
    },
  },
  vouchers: {
    GMATHS_UNUSED01: {
      id: 'GMATHS_UNUSED01',
      code: 'GMATHS_UNUSED01',
      workspaceId: 'gmaths_main',
      ownerUid: 'admin_uid',
      agentId: 'ag_1',
      agentEmail: 'agent1@example.com',
      agentName: 'Field Agent One',
      planAmount: 1200,
      status: 'unused',
      redeemedByUid: '',
      redeemedByEmail: '',
      createdAt: SERVER_TIME,
      redeemedAt: '',
    },
    GMATHS_USED01: {
      id: 'GMATHS_USED01',
      code: 'GMATHS_USED01',
      workspaceId: 'gmaths_main',
      ownerUid: 'admin_uid',
      agentId: 'ag_1',
      agentEmail: 'agent1@example.com',
      agentName: 'Field Agent One',
      planAmount: 1200,
      status: 'redeemed',
      redeemedByUid: 'student_uid',
      redeemedByEmail: 'rohan@example.com',
      createdAt: SERVER_TIME,
      redeemedAt: '2026-02-01',
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
const isPhoneAgentAuth = (auth: AuthContext) =>
  Boolean(
    auth &&
      /^agent\.[0-9]{7,15}@gmaths\.local$/.test(auth.email.toLowerCase()) &&
      auth.sign_in_provider === 'password'
  );
const isAuthorizedAppUser = (auth: AuthContext) =>
  isVerified(auth) || isPhoneAgentAuth(auth);
const isBootstrappedAdmin = (auth: AuthContext) =>
  isVerified(auth) && auth!.email.toLowerCase() === BOOTSTRAPPED_ADMIN;
const isValidId = (id: unknown) =>
  typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
const isValidDate = (d: unknown) =>
  typeof d === 'string' && d.length === 10 && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d);

function hasAllowedKeys(
  data: Record<string, unknown>,
  required: string[],
  allowed: string[]
): boolean {
  const actual = Object.keys(data);
  return (
    required.every((k) => actual.includes(k)) &&
    actual.every((k) => allowed.includes(k))
  );
}

function isAgentAuthorized(auth: AuthContext, data: Record<string, unknown>): boolean {
  if (!isAuthorizedAppUser(auth)) return false;
  const email = auth!.email.toLowerCase();
  return (
    data.ownerUid === auth!.uid ||
    (isBootstrappedAdmin(auth) && data.workspaceId === 'gmaths_main') ||
    (typeof data.email === 'string' && data.email.length >= 3 && data.email === email)
  );
}

function isFamilyScopedAuthorized(auth: AuthContext, data: Record<string, unknown>): boolean {
  if (!isAuthorizedAppUser(auth)) return false;
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
      if (!isAuthorizedAppUser(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      if (!existing) return 'ALLOW';
      return isAgentAuthorized(auth, existing) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      const req = [
        'id', 'workspaceId', 'ownerUid', 'agentCode', 'name', 'phone', 'email',
        'assignedArea', 'commissionRate', 'defaultYearlyFee', 'passcodeHash',
        'isActive', 'createdAt', 'updatedAt',
      ];
      const allowed = [
        ...req,
        'city', 'upiId', 'approvalStatus', 'commissionPerConversion',
      ];
      const validBase =
        isAuthorizedAppUser(auth) &&
        isValidId(docId) &&
        hasAllowedKeys(incoming, req, allowed) &&
        incoming.id === docId &&
        typeof incoming.email === 'string' &&
        incoming.email.length >= 3 &&
        incoming.createdAt === SERVER_TIME &&
        incoming.updatedAt === SERVER_TIME;

      if (!validBase) return 'PERMISSION_DENIED';
      if (isBootstrappedAdmin(auth)) return 'ALLOW';
      const selfSignupOk =
        incoming.ownerUid === auth!.uid &&
        incoming.email === auth!.email.toLowerCase() &&
        incoming.approvalStatus === 'pending' &&
        incoming.isActive === false &&
        incoming.commissionRate === 0 &&
        (!('commissionPerConversion' in incoming) || incoming.commissionPerConversion === 0);
      return selfSignupOk ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'parents') {
    if (op === 'get') {
      if (!isAuthorizedAppUser(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
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
      const ok = isAuthorizedAppUser(auth) && isValidId(docId) && Boolean(dbState.agents[agentId]);
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
      hasAllowedKeys(incoming, req, req) &&
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
      const allowed = [...req, 'isHidden'];
      const childDoc = dbState.children[docId];
      const ok =
        isVerified(auth) &&
        isValidId(docId) &&
        hasAllowedKeys(incoming, req, allowed) &&
        (!('isHidden' in incoming) || incoming.isHidden === false) &&
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

  if (col === 'leaderboard' && op === 'update' && incoming && existing) {
    if (!isVerified(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
    const diffKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
    if (isBootstrappedAdmin(auth)) {
      const ok = diffKeys.every((k) => ['isHidden', 'isFlagged', 'flagReason', 'updatedAt'].includes(k));
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (existing.userId !== auth!.uid) return 'PERMISSION_DENIED';
    if (incoming.isHidden !== existing.isHidden) return 'PERMISSION_DENIED';
    return 'ALLOW';
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

  if (col === 'studentSubscriptions') {
    if (op === 'get') {
      if (!isVerified(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      if (!existing) return 'ALLOW';
      const email = auth!.email.toLowerCase();
      const ok =
        isBootstrappedAdmin(auth) ||
        existing.ownerUid === auth!.uid ||
        existing.subscriberEmail === email ||
        existing.agentEmail === email;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      if (!isVerified(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      const agentId = String(incoming.attributedAgentId ?? '');
      if (agentId) {
        const agentDoc = dbState.agents[agentId];
        if (!agentDoc) return 'PERMISSION_DENIED';
        if (!isBootstrappedAdmin(auth)) {
          if (
            agentDoc.ownerUid === auth!.uid ||
            agentDoc.email === auth!.email.toLowerCase() ||
            Number(incoming.commissionAmount ?? 0) > 350
          ) {
            return 'PERMISSION_DENIED';
          }
        }
      }
      return 'ALLOW';
    }
  }

  if (col === 'payoutRequests') {
    if (op === 'get') {
      if (!isAuthorizedAppUser(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      if (!existing) return 'ALLOW';
      const email = auth!.email.toLowerCase();
      const ok =
        isBootstrappedAdmin(auth) ||
        existing.ownerUid === auth!.uid ||
        existing.agentEmail === email;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'create' && incoming) {
      if (!isAuthorizedAppUser(auth) || !isValidId(docId)) return 'PERMISSION_DENIED';
      const agentDoc = dbState.agents[String(incoming.agentId ?? '')];
      if (!agentDoc) return 'PERMISSION_DENIED';
      const ok =
        Number(incoming.amount ?? 0) >= 500 &&
        incoming.status === 'pending' &&
        incoming.utrNumber === '' &&
        incoming.paidAt === '' &&
        agentDoc.isActive === true &&
        (agentDoc.approvalStatus === undefined || agentDoc.approvalStatus === 'approved') &&
        (isBootstrappedAdmin(auth) || isAgentAuthorized(auth, agentDoc)) &&
        incoming.createdAt === SERVER_TIME &&
        incoming.updatedAt === SERVER_TIME;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && incoming && existing) {
      return isBootstrappedAdmin(auth) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (col === 'vouchers') {
    if (op === 'create' && incoming) {
      return isBootstrappedAdmin(auth) && incoming.status === 'unused' ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && incoming && existing) {
      if (!isVerified(auth)) return 'PERMISSION_DENIED';
      const ok =
        existing.status === 'unused' &&
        incoming.status === 'redeemed' &&
        incoming.redeemedByUid === auth!.uid &&
        incoming.redeemedByEmail === auth!.email.toLowerCase() &&
        incoming.code === existing.code;
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
    name: 'DD-13 Agent Self-Approval Escalation Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'new_ag_uid', email: 'newag@example.com', email_verified: true }, 'agents', 'create', 'ag_self_ok', {
        ...dbState.agents.ag_pending,
        id: 'ag_self_ok',
        ownerUid: 'new_ag_uid',
        email: 'newag@example.com',
        approvalStatus: 'approved',
        isActive: true,
      }),
  },
  {
    name: 'DD-14 Pending Agent Payout Request Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'pending_uid', email: 'pending@example.com', email_verified: true }, 'payoutRequests', 'create', 'pay_pend', {
        ...dbState.payoutRequests.pay_1,
        id: 'pay_pend',
        ownerUid: 'pending_uid',
        agentId: 'ag_pending',
        agentEmail: 'pending@example.com',
      }),
  },
  {
    name: 'DD-15 Below-Minimum ₹400 Payout Request Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'payoutRequests', 'create', 'pay_low', {
        ...dbState.payoutRequests.pay_1,
        id: 'pay_low',
        ownerUid: 'agent_uid',
        amount: 400,
      }),
  },
  {
    name: 'DD-16 Double Offline Voucher Redemption Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true }, 'vouchers', 'update', 'GMATHS_USED01', {
        ...dbState.vouchers.GMATHS_USED01,
        status: 'redeemed',
        redeemedByUid: 'attacker_uid',
        redeemedByEmail: 'attacker@example.com',
      }),
  },
  {
    name: 'DD-17 Cross-Tenant StudentSubscription Read Blocked',
    expected: 'PERMISSION_DENIED',
    run: () => evaluateRule({ uid: 'attacker_uid', email: 'attacker@example.com', email_verified: true }, 'studentSubscriptions', 'get', 'ss_1'),
  },
  {
    name: 'DD-18 Non-Admin Leaderboard isHidden Moderation Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'parent_uid', email: 'parent1@example.com', email_verified: true }, 'leaderboard', 'update', 'lb_1', {
        ...dbState.leaderboard.lb_1,
        isHidden: true,
        updatedAt: SERVER_TIME + 1,
      }),
  },
  {
    name: 'DD-19 Agent Self-Referral Commission Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'studentSubscriptions', 'create', 'ss_self', {
        ...dbState.studentSubscriptions.ss_1,
        id: 'ss_self',
        ownerUid: 'agent_uid',
        subscriberEmail: 'agent1@example.com',
        attributedAgentId: 'ag_1',
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
  {
    name: 'VALID-04 New Sales Agent Self-Sign-Up Strictly Pending',
    expected: 'ALLOW',
    run: () =>
      evaluateRule({ uid: 'new_ag_uid', email: 'newag@example.com', email_verified: true }, 'agents', 'create', 'ag_self_new', {
        ...dbState.agents.ag_pending,
        id: 'ag_self_new',
        ownerUid: 'new_ag_uid',
        email: 'newag@example.com',
        approvalStatus: 'pending',
        isActive: false,
        commissionRate: 0,
        commissionPerConversion: 0,
      }),
  },
  {
    name: 'VALID-05 Approved Agent Requests ₹600 Payout to UPI',
    expected: 'ALLOW',
    run: () =>
      evaluateRule({ uid: 'agent_uid', email: 'agent1@example.com', email_verified: true }, 'payoutRequests', 'create', 'pay_ok', {
        ...dbState.payoutRequests.pay_1,
        id: 'pay_ok',
        ownerUid: 'agent_uid',
      }),
  },
  {
    name: 'VALID-06 Admin Settles Payout & Moderates Leaderboard',
    expected: 'ALLOW',
    run: () => {
      const pRes = evaluateRule({ uid: 'admin_uid', email: BOOTSTRAPPED_ADMIN, email_verified: true }, 'payoutRequests', 'update', 'pay_1', {
        ...dbState.payoutRequests.pay_1,
        status: 'paid',
        utrNumber: 'UTR99887766',
      });
      const mRes = evaluateRule({ uid: 'admin_uid', email: BOOTSTRAPPED_ADMIN, email_verified: true }, 'leaderboard', 'update', 'lb_1', {
        ...dbState.leaderboard.lb_1,
        isHidden: true,
      });
      return pRes === 'ALLOW' && mRes === 'ALLOW' ? 'ALLOW' : 'PERMISSION_DENIED';
    },
  },
  {
    name: 'VALID-07 Student Redeems Unused Offline Cash Voucher Once',
    expected: 'ALLOW',
    run: () =>
      evaluateRule({ uid: 'student2_uid', email: 'student2@example.com', email_verified: true }, 'vouchers', 'update', 'GMATHS_UNUSED01', {
        ...dbState.vouchers.GMATHS_UNUSED01,
        status: 'redeemed',
        redeemedByUid: 'student2_uid',
        redeemedByEmail: 'student2@example.com',
        redeemedAt: '2026-02-02',
      }),
  },
  {
    name: 'DD-20 Password Provider Admin Email Spoof Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule(
        { uid: 'spoof', email: BOOTSTRAPPED_ADMIN, email_verified: false, sign_in_provider: 'password' },
        'agents',
        'get',
        'ag_1'
      ),
  },
  {
    name: 'DD-21 Phone Agent Cannot Read Another Agent Profile',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule(
        { uid: 'phone_ag_uid', email: 'agent.9876501234@gmaths.local', email_verified: false, sign_in_provider: 'password' },
        'agents',
        'get',
        'ag_1'
      ),
  },
  {
    name: 'DD-22 Phone Agent Self-Approval Escalation Blocked',
    expected: 'PERMISSION_DENIED',
    run: () =>
      evaluateRule(
        { uid: 'new_phone_uid', email: 'agent.9988776655@gmaths.local', email_verified: false, sign_in_provider: 'password' },
        'agents',
        'create',
        'ag_phone_bad',
        {
          ...dbState.agents.ag_phone,
          id: 'ag_phone_bad',
          ownerUid: 'new_phone_uid',
          email: 'agent.9988776655@gmaths.local',
          approvalStatus: 'approved',
          isActive: true,
        }
      ),
  },
  {
    name: 'VALID-08 Phone+Password Agent Reads Own Profile & Requests Payout',
    expected: 'ALLOW',
    run: () => {
      const auth = {
        uid: 'phone_ag_uid',
        email: 'agent.9876501234@gmaths.local',
        email_verified: false,
        sign_in_provider: 'password' as const,
      };
      const readRes = evaluateRule(auth, 'agents', 'get', 'ag_phone');
      const payoutRes = evaluateRule(auth, 'payoutRequests', 'create', 'pay_phone', {
        ...dbState.payoutRequests.pay_1,
        id: 'pay_phone',
        ownerUid: 'phone_ag_uid',
        agentId: 'ag_phone',
        agentEmail: 'agent.9876501234@gmaths.local',
      });
      return readRes === 'ALLOW' && payoutRes === 'ALLOW' ? 'ALLOW' : 'PERMISSION_DENIED';
    },
  },
  {
    name: 'VALID-09 Phone+Password Agent Self-Signup Strictly Pending',
    expected: 'ALLOW',
    run: () =>
      evaluateRule(
        { uid: 'new_phone_uid', email: 'agent.9988776655@gmaths.local', email_verified: false, sign_in_provider: 'password' },
        'agents',
        'create',
        'ag_phone_new',
        {
          ...dbState.agents.ag_pending,
          id: 'ag_phone_new',
          ownerUid: 'new_phone_uid',
          email: 'agent.9988776655@gmaths.local',
          phone: '9988776655',
          approvalStatus: 'pending',
          isActive: false,
          commissionRate: 0,
          commissionPerConversion: 0,
        }
      ),
  },
];

for (const t of tests) {
  const actual = t.run();
  assert.equal(actual, t.expected, `FAILED: ${t.name} (expected ${t.expected}, got ${actual})`);
  console.log(`PASS: ${t.name} -> ${actual}`);
}

console.log(`All ${tests.length} RBAC, referral, payout, voucher & leaderboard moderation security tests passed.`);
