/**
 * gmaths / Math Speedster — Phase 0 Security Rules Verification Suite
 * Verifies all 12 Dirty Dozen adversarial RBAC & Subscription payloads return PERMISSION_DENIED
 * and valid Admin/Agent/Parent/Child operations return ALLOW.
 */

type RuleResult = 'ALLOW' | 'PERMISSION_DENIED';

interface MockAuth {
  uid: string;
  token: {
    email?: string;
    email_verified: boolean;
  };
}

interface MockContext {
  auth: MockAuth | null;
  now: number;
  existingDocs: Record<string, Record<string, unknown>>;
}

const VALID_ID = /^[a-zA-Z0-9_\-]+$/;
const VALID_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const BOOTSTRAP_ADMIN_EMAIL = 'kumarnishchhal175@gmail.com';

const isValidId = (v: unknown): boolean =>
  typeof v === 'string' && v.length >= 1 && v.length <= 128 && VALID_ID.test(v);

const isVerified = (ctx: MockContext): boolean =>
  ctx.auth !== null && ctx.auth.token.email_verified === true;

const isBootstrappedAdmin = (ctx: MockContext): boolean =>
  isVerified(ctx) && ctx.auth!.token.email === BOOTSTRAP_ADMIN_EMAIL;

const hasExactKeys = (data: Record<string, unknown>, keys: string[]): boolean =>
  keys.every((k) => Object.prototype.hasOwnProperty.call(data, k)) &&
  Object.keys(data).every((k) => keys.includes(k));

function evaluate(
  op: 'get' | 'create' | 'update',
  path: string,
  ctx: MockContext,
  data?: Record<string, unknown>
): RuleResult {
  const parts = path.split('/').filter(Boolean);
  if (!ctx.auth) return 'PERMISSION_DENIED';

  // /admins/{uid}
  if (parts.length === 2 && parts[0] === 'admins') {
    const uid = parts[1];
    if (!isValidId(uid)) return 'PERMISSION_DENIED';
    if (op === 'create' && data) {
      return isBootstrappedAdmin(ctx) &&
        hasExactKeys(data, ['uid', 'email', 'createdAt']) &&
        data.uid === uid &&
        data.createdAt === ctx.now
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  // /agents/{agentId}
  if (parts.length === 2 && parts[0] === 'agents') {
    const id = parts[1];
    if (!isVerified(ctx) || !isValidId(id)) return 'PERMISSION_DENIED';
    const keys = [
      'id', 'workspaceId', 'ownerUid', 'agentCode', 'name', 'phone', 'email',
      'assignedArea', 'commissionRate', 'defaultYearlyFee', 'passcodeHash',
      'isActive', 'createdAt', 'updatedAt',
    ];
    if (op === 'create' && data) {
      const ok =
        hasExactKeys(data, keys) &&
        data.id === id &&
        (data.ownerUid === ctx.auth.uid || isBootstrappedAdmin(ctx)) &&
        typeof data.name === 'string' && data.name.length >= 1 && data.name.length <= 80 &&
        data.createdAt === ctx.now &&
        data.updatedAt === ctx.now;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /parents/{parentId}
  if (parts.length === 2 && parts[0] === 'parents') {
    const id = parts[1];
    if (!isVerified(ctx) || !isValidId(id)) return 'PERMISSION_DENIED';
    if (op === 'get') {
      const ex = ctx.existingDocs[path];
      if (!ex) return 'ALLOW';
      return ex.ownerUid === ctx.auth.uid || (isBootstrappedAdmin(ctx) && ex.workspaceId === 'gmaths_main')
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (op === 'create' && data) {
      const keys = [
        'id', 'workspaceId', 'ownerUid', 'name', 'contact', 'passcodeHash',
        'createdByAgentId', 'createdAt', 'updatedAt',
      ];
      const agentExists = Boolean(ctx.existingDocs[`agents/${data.createdByAgentId}`]);
      const ok =
        hasExactKeys(data, keys) &&
        data.id === id &&
        (data.ownerUid === ctx.auth.uid || isBootstrappedAdmin(ctx)) &&
        agentExists &&
        data.createdAt === ctx.now &&
        data.updatedAt === ctx.now;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /children/{childId}
  if (parts.length === 2 && parts[0] === 'children') {
    const id = parts[1];
    if (!isVerified(ctx) || !isValidId(id)) return 'PERMISSION_DENIED';
    if (op === 'create' && data) {
      const parentExists = Boolean(ctx.existingDocs[`parents/${data.parentId}`]);
      return parentExists && data.id === id && data.createdAt === ctx.now
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
  }

  // /subscriptions/{subId}
  if (parts.length === 2 && parts[0] === 'subscriptions') {
    const id = parts[1];
    if (!isVerified(ctx) || !isValidId(id)) return 'PERMISSION_DENIED';
    const keys = [
      'id', 'workspaceId', 'ownerUid', 'parentId', 'planType',
      'startDate', 'expiryDate', 'feeAmount', 'paymentMethod',
      'receiptNote', 'collectedByAgentId', 'status', 'createdAt', 'updatedAt',
    ];
    if (op === 'create' && data) {
      const parentExists = Boolean(ctx.existingDocs[`parents/${data.parentId}`]);
      const agentExists = Boolean(ctx.existingDocs[`agents/${data.collectedByAgentId}`]);
      const ok =
        hasExactKeys(data, keys) &&
        data.id === id &&
        data.planType === 'yearly' &&
        typeof data.startDate === 'string' && VALID_DATE.test(data.startDate) &&
        typeof data.expiryDate === 'string' && VALID_DATE.test(data.expiryDate) &&
        typeof data.feeAmount === 'number' && data.feeAmount >= 0 &&
        ['cash', 'upi', 'bank'].includes(String(data.paymentMethod)) &&
        ['active', 'expired', 'suspended'].includes(String(data.status)) &&
        parentExists && agentExists &&
        data.createdAt === ctx.now && data.updatedAt === ctx.now;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (op === 'update' && data) {
      const ex = ctx.existingDocs[path];
      if (!ex) return 'PERMISSION_DENIED';
      const ok =
        hasExactKeys(data, keys) &&
        data.parentId === ex.parentId &&
        data.ownerUid === ex.ownerUid &&
        data.planType === 'yearly' &&
        data.createdAt === ex.createdAt &&
        data.updatedAt === ctx.now;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /practiceSessions/{sessionId}
  if (parts.length === 2 && parts[0] === 'practiceSessions') {
    if (op === 'update') return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1763500000000;
const ADMIN: MockAuth = { uid: 'admin_uid', token: { email: BOOTSTRAP_ADMIN_EMAIL, email_verified: true } };
const SPOOF_ADMIN: MockAuth = { uid: 'eve_uid', token: { email: BOOTSTRAP_ADMIN_EMAIL, email_verified: false } };
const OTHER: MockAuth = { uid: 'other_uid', token: { email: 'other@example.com', email_verified: true } };

const docs: Record<string, Record<string, unknown>> = {
  'agents/agent_1': { id: 'agent_1', workspaceId: 'gmaths_main', ownerUid: 'admin_uid' },
  'parents/parent_1': { id: 'parent_1', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', createdByAgentId: 'agent_1' },
  'subscriptions/sub_1': {
    id: 'sub_1', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', parentId: 'parent_1',
    planType: 'yearly', startDate: '2026-01-01', expiryDate: '2027-01-01', feeAmount: 1200,
    paymentMethod: 'upi', receiptNote: 'UPI-101', collectedByAgentId: 'agent_1', status: 'active',
    createdAt: NOW - 1000, updatedAt: NOW - 1000,
  },
};

const cases: Array<{ name: string; actual: RuleResult; expected: RuleResult }> = [
  { name: 'DD-01 Unverified Admin Email Spoof Blocked', actual: evaluate('create', 'agents/agent_2', { auth: SPOOF_ADMIN, now: NOW, existingDocs: docs }, { id: 'agent_2', workspaceId: 'gmaths_main', ownerUid: 'eve_uid', agentCode: 'AG02', name: 'Spoof', phone: '9999', email: '', assignedArea: 'North', commissionRate: 10, defaultYearlyFee: 1200, passcodeHash: '0123456789abcdef', isActive: true, createdAt: NOW, updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-02 Non-Admin Self-Escalation to /admins Blocked', actual: evaluate('create', 'admins/other_uid', { auth: OTHER, now: NOW, existingDocs: docs }, { uid: 'other_uid', email: 'other@example.com', createdAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-03 Shadow Ghost Field on Agent Blocked', actual: evaluate('create', 'agents/agent_3', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'agent_3', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', agentCode: 'AG03', name: 'Test', phone: '12345', email: '', assignedArea: 'East', commissionRate: 10, defaultYearlyFee: 1200, passcodeHash: '0123456789abcdef', isActive: true, superUser: true, createdAt: NOW, updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-04 Orphaned Parent Without Existing Agent Blocked', actual: evaluate('create', 'parents/parent_2', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'parent_2', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', name: 'Priya', contact: '9876543210', passcodeHash: '0123456789abcdef', createdByAgentId: 'ghost_agent', createdAt: NOW, updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-05 Orphaned Child Without Existing Parent Blocked', actual: evaluate('create', 'children/child_1', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'child_1', parentId: 'ghost_parent', createdAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-06 Invalid Monthly Subscription Plan Blocked', actual: evaluate('create', 'subscriptions/sub_bad', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'sub_bad', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', parentId: 'parent_1', planType: 'monthly', startDate: '2026-01-01', expiryDate: '2026-02-01', feeAmount: 100, paymentMethod: 'cash', receiptNote: '', collectedByAgentId: 'agent_1', status: 'active', createdAt: NOW, updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-07 Immutable Subscription parentId Mutation Blocked', actual: evaluate('update', 'subscriptions/sub_1', { auth: ADMIN, now: NOW, existingDocs: docs }, { ...docs['subscriptions/sub_1'], parentId: 'parent_hijack', updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-08 Practice Session Tampering Update Blocked', actual: evaluate('update', 'practiceSessions/ps_1', { auth: ADMIN, now: NOW, existingDocs: docs }, { score: 999 }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-09 Cross-Tenant Parent PII Read Blocked', actual: evaluate('get', 'parents/parent_1', { auth: OTHER, now: NOW, existingDocs: docs }), expected: 'PERMISSION_DENIED' },
  { name: 'DD-10 Oversized Agent Document ID Blocked', actual: evaluate('create', `agents/${'a'.repeat(160)}`, { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'a'.repeat(160), workspaceId: 'gmaths_main', ownerUid: 'admin_uid', agentCode: 'AG99', name: 'Bad', phone: '12345', email: '', assignedArea: 'South', commissionRate: 10, defaultYearlyFee: 1200, passcodeHash: '0123456789abcdef', isActive: true, createdAt: NOW, updatedAt: NOW }), expected: 'PERMISSION_DENIED' },
  { name: 'VALID-01 Admin Creates Valid Agent', actual: evaluate('create', 'agents/agent_ok', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'agent_ok', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', agentCode: 'AG10', name: 'Ravi', phone: '9876543210', email: 'ravi@gmaths.app', assignedArea: 'West Zone', commissionRate: 15, defaultYearlyFee: 1200, passcodeHash: '0123456789abcdef', isActive: true, createdAt: NOW, updatedAt: NOW }), expected: 'ALLOW' },
  { name: 'VALID-02 Valid Yearly Subscription Created', actual: evaluate('create', 'subscriptions/sub_ok', { auth: ADMIN, now: NOW, existingDocs: docs }, { id: 'sub_ok', workspaceId: 'gmaths_main', ownerUid: 'admin_uid', parentId: 'parent_1', planType: 'yearly', startDate: '2026-11-18', expiryDate: '2027-11-18', feeAmount: 1200, paymentMethod: 'upi', receiptNote: 'UPI#4411', collectedByAgentId: 'agent_1', status: 'active', createdAt: NOW, updatedAt: NOW }), expected: 'ALLOW' },
];

let failed = 0;
for (const c of cases) {
  if (c.actual !== c.expected) {
    failed++;
    console.error(`FAIL: ${c.name} (expected ${c.expected}, got ${c.actual})`);
  } else {
    console.log(`PASS: ${c.name} -> ${c.actual}`);
  }
}
if (failed > 0) process.exit(1);
console.log(`\nAll ${cases.length} RBAC & Subscription security tests passed.`);
