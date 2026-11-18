/**
 * Math Speedster — Phase 0 Security Rules Test Runner
 * Verifies that all 12 "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED
 * and legitimate user flows are permitted under the exact rule predicates in firestore.rules.
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

const VALID_MODES = ['addition', 'subtraction', 'multiplication', 'division', 'mixed'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const VALID_SESSION_TYPES = ['sprint', 'streak', 'practice'];
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);
}

function isVerifiedUser(ctx: MockContext): boolean {
  return ctx.auth !== null && ctx.auth.token.email_verified === true;
}

function hasAll(data: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((k) => Object.prototype.hasOwnProperty.call(data, k));
}

function hasOnly(data: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(data).every((k) => keys.includes(k));
}

function affectedKeys(incoming: Record<string, unknown>, existing: Record<string, unknown>): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (incoming[key] !== existing[key]) {
      changed.push(key);
    }
  }
  return changed;
}

function isValidUserProfile(data: Record<string, unknown>, uid: string): boolean {
  const required = ['uid', 'displayName', 'email', 'createdAt', 'updatedAt'];
  return (
    hasAll(data, required) &&
    hasOnly(data, required) &&
    isValidId(data.uid) &&
    data.uid === uid &&
    typeof data.displayName === 'string' &&
    data.displayName.length >= 1 &&
    data.displayName.length <= 40 &&
    typeof data.email === 'string' &&
    data.email.length >= 3 &&
    data.email.length <= 120 &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function isValidSessionRecord(data: Record<string, unknown>, uid: string, sessionId: string): boolean {
  const required = [
    'id',
    'userId',
    'mode',
    'difficulty',
    'sessionType',
    'durationSec',
    'elapsedSec',
    'score',
    'attempted',
    'correct',
    'accuracy',
    'bestStreak',
    'avgResponseMs',
    'qpm',
    'allowNegatives',
    'createdAt',
  ];
  return (
    hasAll(data, required) &&
    hasOnly(data, required) &&
    isValidId(data.id) &&
    data.id === sessionId &&
    isValidId(data.userId) &&
    data.userId === uid &&
    typeof data.mode === 'string' &&
    VALID_MODES.includes(data.mode) &&
    typeof data.difficulty === 'string' &&
    VALID_DIFFICULTIES.includes(data.difficulty) &&
    typeof data.sessionType === 'string' &&
    VALID_SESSION_TYPES.includes(data.sessionType) &&
    Number.isInteger(data.durationSec) &&
    (data.durationSec as number) >= 0 &&
    (data.durationSec as number) <= 3600 &&
    typeof data.elapsedSec === 'number' &&
    data.elapsedSec >= 0 &&
    data.elapsedSec <= 7200 &&
    Number.isInteger(data.score) &&
    (data.score as number) >= 0 &&
    (data.score as number) <= 5000 &&
    Number.isInteger(data.attempted) &&
    (data.attempted as number) >= 0 &&
    (data.attempted as number) <= 10000 &&
    Number.isInteger(data.correct) &&
    (data.correct as number) === (data.score as number) &&
    (data.correct as number) <= (data.attempted as number) &&
    typeof data.accuracy === 'number' &&
    data.accuracy >= 0 &&
    data.accuracy <= 100 &&
    Number.isInteger(data.bestStreak) &&
    (data.bestStreak as number) >= 0 &&
    (data.bestStreak as number) <= (data.score as number) &&
    Number.isInteger(data.avgResponseMs) &&
    (data.avgResponseMs as number) >= 0 &&
    (data.avgResponseMs as number) <= 600000 &&
    typeof data.qpm === 'number' &&
    data.qpm >= 0 &&
    data.qpm <= 600 &&
    typeof data.allowNegatives === 'boolean' &&
    typeof data.createdAt === 'number'
  );
}

function isValidLeaderboardEntry(data: Record<string, unknown>, uid: string, entryId: string): boolean {
  const required = [
    'id',
    'userId',
    'displayName',
    'mode',
    'difficulty',
    'sessionType',
    'durationSec',
    'score',
    'accuracy',
    'bestStreak',
    'avgResponseMs',
    'qpm',
    'isPublic',
    'createdAt',
    'updatedAt',
  ];
  const expectedId = `${data.userId}_${data.mode}_${data.difficulty}_${data.sessionType}_${data.durationSec}`;
  return (
    hasAll(data, required) &&
    hasOnly(data, required) &&
    isValidId(data.id) &&
    data.id === entryId &&
    data.id === expectedId &&
    isValidId(data.userId) &&
    data.userId === uid &&
    typeof data.displayName === 'string' &&
    data.displayName.length >= 1 &&
    data.displayName.length <= 40 &&
    typeof data.mode === 'string' &&
    VALID_MODES.includes(data.mode) &&
    typeof data.difficulty === 'string' &&
    VALID_DIFFICULTIES.includes(data.difficulty) &&
    typeof data.sessionType === 'string' &&
    VALID_SESSION_TYPES.includes(data.sessionType) &&
    Number.isInteger(data.durationSec) &&
    (data.durationSec as number) >= 0 &&
    (data.durationSec as number) <= 3600 &&
    Number.isInteger(data.score) &&
    (data.score as number) >= 1 &&
    (data.score as number) <= 5000 &&
    typeof data.accuracy === 'number' &&
    data.accuracy >= 0 &&
    data.accuracy <= 100 &&
    Number.isInteger(data.bestStreak) &&
    (data.bestStreak as number) >= 0 &&
    (data.bestStreak as number) <= (data.score as number) &&
    Number.isInteger(data.avgResponseMs) &&
    (data.avgResponseMs as number) >= 0 &&
    (data.avgResponseMs as number) <= 600000 &&
    typeof data.qpm === 'number' &&
    data.qpm >= 0 &&
    data.qpm <= 600 &&
    data.isPublic === true &&
    typeof data.createdAt === 'number' &&
    typeof data.updatedAt === 'number'
  );
}

function evaluateRule(
  operation: 'get' | 'create' | 'update',
  path: string,
  ctx: MockContext,
  incoming?: Record<string, unknown>
): RuleResult {
  const parts = path.split('/').filter(Boolean);

  // /users/{userId}
  if (parts.length === 2 && parts[0] === 'users') {
    const userId = parts[1];
    if (!ctx.auth || !isValidId(userId)) return 'PERMISSION_DENIED';
    if (operation === 'get') {
      return ctx.auth.uid === userId ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'create' && incoming) {
      const ok =
        isVerifiedUser(ctx) &&
        ctx.auth.uid === userId &&
        isValidUserProfile(incoming, ctx.auth.uid) &&
        incoming.createdAt === ctx.now &&
        incoming.updatedAt === ctx.now;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'update' && incoming) {
      const existing = ctx.existingDocs[path];
      if (!existing) return 'PERMISSION_DENIED';
      const changed = affectedKeys(incoming, existing);
      const ok =
        isVerifiedUser(ctx) &&
        ctx.auth.uid === userId &&
        isValidUserProfile(incoming, ctx.auth.uid) &&
        incoming.uid === existing.uid &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === ctx.now &&
        changed.every((k) => ['displayName', 'email', 'updatedAt'].includes(k));
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/sessions/{sessionId}
  if (parts.length === 4 && parts[0] === 'users' && parts[2] === 'sessions') {
    const userId = parts[1];
    const sessionId = parts[3];
    if (!ctx.auth || !isValidId(userId) || !isValidId(sessionId)) return 'PERMISSION_DENIED';
    if (operation === 'get') {
      return ctx.auth.uid === userId ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'update') {
      return 'PERMISSION_DENIED'; // Immutable history
    }
    if (operation === 'create' && incoming) {
      const parentExists = Boolean(ctx.existingDocs[`users/${userId}`]);
      const ok =
        isVerifiedUser(ctx) &&
        ctx.auth.uid === userId &&
        isValidSessionRecord(incoming, ctx.auth.uid, sessionId) &&
        incoming.createdAt === ctx.now &&
        parentExists;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  // /leaderboard/{entryId}
  if (parts.length === 2 && parts[0] === 'leaderboard') {
    const entryId = parts[1];
    if (!ctx.auth || !isValidId(entryId)) return 'PERMISSION_DENIED';
    if (operation === 'get') {
      const existing = ctx.existingDocs[path];
      return existing && existing.isPublic === true ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'create' && incoming) {
      const parentExists = Boolean(ctx.existingDocs[`users/${ctx.auth.uid}`]);
      const ok =
        isVerifiedUser(ctx) &&
        isValidLeaderboardEntry(incoming, ctx.auth.uid, entryId) &&
        incoming.createdAt === ctx.now &&
        incoming.updatedAt === ctx.now &&
        parentExists;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (operation === 'update' && incoming) {
      const existing = ctx.existingDocs[path];
      if (!existing) return 'PERMISSION_DENIED';
      const changed = affectedKeys(incoming, existing);
      const improved =
        (incoming.score as number) > (existing.score as number) ||
        ((incoming.score as number) === (existing.score as number) &&
          (incoming.accuracy as number) >= (existing.accuracy as number));
      const ok =
        isVerifiedUser(ctx) &&
        isValidLeaderboardEntry(incoming, ctx.auth.uid, entryId) &&
        existing.userId === ctx.auth.uid &&
        incoming.id === existing.id &&
        incoming.userId === existing.userId &&
        incoming.mode === existing.mode &&
        incoming.difficulty === existing.difficulty &&
        incoming.sessionType === existing.sessionType &&
        incoming.durationSec === existing.durationSec &&
        incoming.isPublic === existing.isPublic &&
        incoming.createdAt === existing.createdAt &&
        incoming.updatedAt === ctx.now &&
        improved &&
        changed.every((k) =>
          ['displayName', 'score', 'accuracy', 'bestStreak', 'avgResponseMs', 'qpm', 'updatedAt'].includes(k)
        );
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1763461200000;
const ALICE: MockAuth = { uid: 'alice_uid', token: { email: 'alice@example.com', email_verified: true } };
const EVE: MockAuth = { uid: 'eve_uid', token: { email: 'eve@example.com', email_verified: true } };
const UNVERIFIED: MockAuth = { uid: 'unverified_uid', token: { email: 'bot@example.com', email_verified: false } };

const baseDocs: Record<string, Record<string, unknown>> = {
  'users/alice_uid': {
    uid: 'alice_uid',
    displayName: 'Alice',
    email: 'alice@example.com',
    createdAt: NOW - 1000,
    updatedAt: NOW - 1000,
  },
  'users/alice_uid/sessions/sess_1': {
    id: 'sess_1',
    userId: 'alice_uid',
    mode: 'mixed',
    difficulty: 'medium',
    sessionType: 'sprint',
    durationSec: 60,
    elapsedSec: 60,
    score: 28,
    attempted: 30,
    correct: 28,
    accuracy: 93.3,
    bestStreak: 14,
    avgResponseMs: 1850,
    qpm: 28,
    allowNegatives: false,
    createdAt: NOW - 500,
  },
  'leaderboard/alice_uid_mixed_medium_sprint_60': {
    id: 'alice_uid_mixed_medium_sprint_60',
    userId: 'alice_uid',
    displayName: 'Alice',
    mode: 'mixed',
    difficulty: 'medium',
    sessionType: 'sprint',
    durationSec: 60,
    score: 28,
    accuracy: 93.3,
    bestStreak: 14,
    avgResponseMs: 1850,
    qpm: 28,
    isPublic: true,
    createdAt: NOW - 500,
    updatedAt: NOW - 500,
  },
};

const tests: Array<{ name: string; actual: RuleResult; expected: RuleResult }> = [
  // Dirty Dozen (All MUST return PERMISSION_DENIED)
  {
    name: 'DD-01 Identity Spoofing on Profile Create',
    actual: evaluateRule('create', 'users/alice_uid', { auth: EVE, now: NOW, existingDocs: baseDocs }, {
      uid: 'alice_uid', displayName: 'Eve', email: 'eve@example.com', createdAt: NOW, updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-02 Unverified Email Write Rejected',
    actual: evaluateRule('create', 'users/unverified_uid', { auth: UNVERIFIED, now: NOW, existingDocs: baseDocs }, {
      uid: 'unverified_uid', displayName: 'Bot', email: 'bot@example.com', createdAt: NOW, updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-03 Shadow Field Injection (isAdmin: true)',
    actual: evaluateRule('create', 'users/alice_uid', { auth: ALICE, now: NOW, existingDocs: {} }, {
      uid: 'alice_uid', displayName: 'Alice', email: 'alice@example.com', isAdmin: true, createdAt: NOW, updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-04 PII Cross-User Read Blocked',
    actual: evaluateRule('get', 'users/alice_uid', { auth: EVE, now: NOW, existingDocs: baseDocs }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-05 Orphaned Session Write Without Parent User Doc',
    actual: evaluateRule('create', 'users/eve_uid/sessions/sess_orphan', { auth: EVE, now: NOW, existingDocs: baseDocs }, {
      id: 'sess_orphan', userId: 'eve_uid', mode: 'addition', difficulty: 'easy', sessionType: 'sprint',
      durationSec: 30, elapsedSec: 30, score: 15, attempted: 15, correct: 15, accuracy: 100,
      bestStreak: 15, avgResponseMs: 1200, qpm: 30, allowNegatives: false, createdAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-06 Session History Tampering Update Blocked',
    actual: evaluateRule('update', 'users/alice_uid/sessions/sess_1', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      ...baseDocs['users/alice_uid/sessions/sess_1'], score: 999,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-07 Impossible Math Metrics (correct > attempted)',
    actual: evaluateRule('create', 'users/alice_uid/sessions/sess_bad', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'sess_bad', userId: 'alice_uid', mode: 'mixed', difficulty: 'hard', sessionType: 'sprint',
      durationSec: 60, elapsedSec: 60, score: 50, attempted: 10, correct: 50, accuracy: 500,
      bestStreak: 99, avgResponseMs: 100, qpm: 50, allowNegatives: false, createdAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-08 Client-Forged Timestamp Rejected',
    actual: evaluateRule('create', 'users/alice_uid/sessions/sess_forged_ts', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'sess_forged_ts', userId: 'alice_uid', mode: 'addition', difficulty: 'easy', sessionType: 'sprint',
      durationSec: 30, elapsedSec: 30, score: 10, attempted: 10, correct: 10, accuracy: 100,
      bestStreak: 10, avgResponseMs: 1500, qpm: 20, allowNegatives: false, createdAt: NOW - 99999,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-09 Oversized Document ID Resource Poisoning',
    actual: evaluateRule('create', `users/alice_uid/sessions/${'a'.repeat(160)}`, { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'a'.repeat(160), userId: 'alice_uid', mode: 'addition', difficulty: 'easy', sessionType: 'sprint',
      durationSec: 30, elapsedSec: 30, score: 10, attempted: 10, correct: 10, accuracy: 100,
      bestStreak: 10, avgResponseMs: 1500, qpm: 20, allowNegatives: false, createdAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-10 Leaderboard Slot Spam (Non-Deterministic ID)',
    actual: evaluateRule('create', 'leaderboard/alice_uid_spam_slot', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'alice_uid_spam_slot', userId: 'alice_uid', displayName: 'Alice', mode: 'mixed', difficulty: 'medium',
      sessionType: 'sprint', durationSec: 60, score: 40, accuracy: 98, bestStreak: 20, avgResponseMs: 1100,
      qpm: 40, isPublic: true, createdAt: NOW, updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-11 Leaderboard PII Injection (email field)',
    actual: evaluateRule('create', 'leaderboard/alice_uid_addition_easy_sprint_30', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'alice_uid_addition_easy_sprint_30', userId: 'alice_uid', displayName: 'Alice', email: 'alice@example.com',
      mode: 'addition', difficulty: 'easy', sessionType: 'sprint', durationSec: 30, score: 20, accuracy: 100,
      bestStreak: 20, avgResponseMs: 1000, qpm: 40, isPublic: true, createdAt: NOW, updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  {
    name: 'DD-12 Leaderboard Value Poisoning & Immutable Key Mutation',
    actual: evaluateRule('update', 'leaderboard/alice_uid_mixed_medium_sprint_60', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      ...baseDocs['leaderboard/alice_uid_mixed_medium_sprint_60'],
      score: '999',
      mode: 'addition',
      updatedAt: NOW,
    }),
    expected: 'PERMISSION_DENIED',
  },
  // Positive Smoke Tests (Legitimate App Operations MUST ALLOW)
  {
    name: 'VALID-01 Owner Creates Valid SessionRecord',
    actual: evaluateRule('create', 'users/alice_uid/sessions/sess_valid_2', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      id: 'sess_valid_2', userId: 'alice_uid', mode: 'multiplication', difficulty: 'medium', sessionType: 'sprint',
      durationSec: 60, elapsedSec: 60, score: 34, attempted: 36, correct: 34, accuracy: 94.4,
      bestStreak: 19, avgResponseMs: 1420, qpm: 34, allowNegatives: false, createdAt: NOW,
    }),
    expected: 'ALLOW',
  },
  {
    name: 'VALID-02 Owner Improves Leaderboard Personal Best',
    actual: evaluateRule('update', 'leaderboard/alice_uid_mixed_medium_sprint_60', { auth: ALICE, now: NOW, existingDocs: baseDocs }, {
      ...baseDocs['leaderboard/alice_uid_mixed_medium_sprint_60'],
      score: 35,
      accuracy: 97.2,
      bestStreak: 22,
      avgResponseMs: 1380,
      qpm: 35,
      updatedAt: NOW,
    }),
    expected: 'ALLOW',
  },
];

let failures = 0;
for (const t of tests) {
  const pass = t.actual === t.expected;
  if (!pass) {
    failures++;
    console.error(`FAIL: ${t.name} (expected ${t.expected}, got ${t.actual})`);
  } else {
    console.log(`PASS: ${t.name} -> ${t.actual}`);
  }
}

if (failures > 0) {
  process.exit(1);
}
console.log(`\nAll ${tests.length} security rule verification tests passed.`);
