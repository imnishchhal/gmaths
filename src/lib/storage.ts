import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  ArithmeticMode,
  Difficulty,
  LeaderboardRecord,
  SessionRecord,
  SessionType,
  getPresetKey,
} from '../types/math';
import { isSuspiciousSpeedRun } from '../types/platform';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  buildLeaderboardEntryId,
  sanitizeDisplayName,
  sanitizeEmail,
  sanitizeId,
  sanitizeSessionPayload,
} from './firestoreValidation';
import { formatAuthIdentityLabel } from '../utils/referral';

const LOCAL_SESSIONS_KEY = 'math_speedster_sessions_v1';
const MAX_LOCAL_SESSIONS = 150;

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return Date.now();
}

// -----------------------------------------------------------------------------
// LocalStorage Fallback Layer (Always available immediately out of the box)
// -----------------------------------------------------------------------------

export function loadLocalSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SessionRecord => Boolean(item && item.id))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  } catch {
    return [];
  }
}

export function saveLocalSession(session: SessionRecord): SessionRecord[] {
  const existing = loadLocalSessions().filter((s) => s.id !== session.id);
  const next = [session, ...existing].slice(0, MAX_LOCAL_SESSIONS);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}

export function removeLocalSession(sessionId: string): SessionRecord[] {
  const next = loadLocalSessions().filter((s) => s.id !== sessionId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_SESSIONS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return next;
}

export function clearLocalSessions(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LOCAL_SESSIONS_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export function computePersonalBests(
  sessions: SessionRecord[]
): Record<string, SessionRecord> {
  const map: Record<string, SessionRecord> = {};
  for (const s of sessions) {
    const key = getPresetKey(s.mode, s.difficulty, s.sessionType, s.durationSec);
    const current = map[key];
    if (
      !current ||
      s.score > current.score ||
      (s.score === current.score && s.accuracy > current.accuracy) ||
      (s.score === current.score &&
        s.accuracy === current.accuracy &&
        s.avgResponseMs < current.avgResponseMs)
    ) {
      map[key] = s;
    }
  }
  return map;
}

// -----------------------------------------------------------------------------
// Cloud Firestore Persistence Layer
// -----------------------------------------------------------------------------

export async function ensureUserProfile(user: User): Promise<string> {
  if (!db) return sanitizeDisplayName(user.displayName);
  const uid = sanitizeId(user.uid, 'u');
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const displayName = sanitizeDisplayName(
    existingSnap.exists()
      ? (existingSnap.data().displayName as string | undefined) ?? user.displayName
      : user.displayName ??
          (formatAuthIdentityLabel(user.email) || user.email?.split('@')[0])
  );
  const email = sanitizeEmail(user.email);

  if (!existingSnap.exists()) {
    try {
      await setDoc(userRef, {
        uid,
        displayName,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  } else {
    const existingData = existingSnap.data();
    if (existingData.email !== email || existingData.displayName !== displayName) {
      try {
        await updateDoc(userRef, {
          displayName,
          email,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
  }

  return displayName;
}

export async function updateUserDisplayName(
  user: User,
  newName: string
): Promise<string> {
  const cleanName = sanitizeDisplayName(newName);
  if (!db) return cleanName;
  const uid = sanitizeId(user.uid, 'u');
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    await updateDoc(userRef, {
      displayName: cleanName,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  return cleanName;
}

/**
 * Saves an immutable completed session to /users/{uid}/sessions/{sessionId}
 * and creates or updates the user's personal best entry in /leaderboard/{entryId}.
 */
export async function saveSessionToCloud(
  user: User,
  session: SessionRecord,
  preferredDisplayName?: string
): Promise<{ leaderboardUpdated: boolean }> {
  if (!db) return { leaderboardUpdated: false };

  const uid = sanitizeId(user.uid, 'u');
  const displayName = await ensureUserProfile(user);
  const finalName = sanitizeDisplayName(preferredDisplayName || displayName);

  const sanitized = sanitizeSessionPayload(uid, session);
  const sessionPath = `users/${uid}/sessions/${sanitized.id}`;
  const sessionRef = doc(db, 'users', uid, 'sessions', sanitized.id);

  // Check if already synced (idempotent for local-to-cloud sync)
  let existingSession;
  try {
    existingSession = await getDoc(sessionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, sessionPath);
  }

  if (!existingSession.exists()) {
    try {
      await setDoc(sessionRef, {
        ...sanitized,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, sessionPath);
    }
  }

  // Only post runs with score >= 1 to the public leaderboard
  if (sanitized.score < 1) {
    return { leaderboardUpdated: false };
  }

  const entryId = buildLeaderboardEntryId(
    uid,
    sanitized.mode,
    sanitized.difficulty,
    sanitized.sessionType,
    sanitized.durationSec
  );
  const leaderboardPath = `leaderboard/${entryId}`;
  const leaderboardRef = doc(db, 'leaderboard', entryId);

  let existingEntry;
  try {
    existingEntry = await getDoc(leaderboardRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, leaderboardPath);
  }

  const flagged = isSuspiciousSpeedRun(sanitized.avgResponseMs, sanitized.score);
  const flagReason = flagged
    ? `Suspicious speed: ${sanitized.avgResponseMs}ms avg across ${sanitized.score} solved`
    : '';

  if (!existingEntry.exists()) {
    try {
      await setDoc(leaderboardRef, {
        id: entryId,
        userId: uid,
        displayName: finalName,
        mode: sanitized.mode,
        difficulty: sanitized.difficulty,
        sessionType: sanitized.sessionType,
        durationSec: sanitized.durationSec,
        score: sanitized.score,
        accuracy: sanitized.accuracy,
        bestStreak: sanitized.bestStreak,
        avgResponseMs: sanitized.avgResponseMs,
        qpm: sanitized.qpm,
        isPublic: true,
        isHidden: false,
        isFlagged: flagged,
        flagReason,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { leaderboardUpdated: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, leaderboardPath);
    }
  } else {
    const prev = existingEntry.data();
    const prevScore = Number(prev.score ?? 0);
    const prevAccuracy = Number(prev.accuracy ?? 0);
    const isImprovement =
      sanitized.score > prevScore ||
      (sanitized.score === prevScore && sanitized.accuracy >= prevAccuracy);

    if (isImprovement) {
      try {
        await updateDoc(leaderboardRef, {
          displayName: finalName,
          score: sanitized.score,
          accuracy: sanitized.accuracy,
          bestStreak: sanitized.bestStreak,
          avgResponseMs: sanitized.avgResponseMs,
          qpm: sanitized.qpm,
          isFlagged: flagged || Boolean(prev.isFlagged),
          flagReason: flagged ? flagReason : String(prev.flagReason ?? ''),
          updatedAt: serverTimestamp(),
        });
        return { leaderboardUpdated: true };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, leaderboardPath);
      }
    }
  }

  return { leaderboardUpdated: false };
}

export async function cloudUpdateLeaderboardModeration(
  entryId: string,
  patch: { isHidden?: boolean; isFlagged?: boolean; flagReason?: string }
): Promise<void> {
  if (!db) return;
  const safeId = sanitizeId(entryId, 'lb');
  const path = `leaderboard/${safeId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof patch.isHidden === 'boolean') payload.isHidden = patch.isHidden;
  if (typeof patch.isFlagged === 'boolean') payload.isFlagged = patch.isFlagged;
  if (typeof patch.flagReason === 'string') {
    payload.flagReason = patch.flagReason.slice(0, 160);
  }
  try {
    await updateDoc(doc(db, 'leaderboard', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCloudSession(
  userId: string,
  sessionId: string
): Promise<void> {
  if (!db) return;
  const uid = sanitizeId(userId, 'u');
  const sid = sanitizeId(sessionId, 's');
  const path = `users/${uid}/sessions/${sid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', sid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserSessions(
  userId: string,
  onSessions: (sessions: SessionRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const uid = sanitizeId(userId, 'u');
  const path = `users/${uid}/sessions`;
  const q = query(
    collection(db, 'users', uid, 'sessions'),
    where('userId', '==', uid),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SessionRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          userId: String(d.userId ?? uid),
          mode: d.mode as ArithmeticMode,
          difficulty: d.difficulty as Difficulty,
          sessionType: d.sessionType as SessionType,
          durationSec: Number(d.durationSec ?? 0),
          elapsedSec: Number(d.elapsedSec ?? 0),
          score: Number(d.score ?? 0),
          attempted: Number(d.attempted ?? 0),
          correct: Number(d.correct ?? 0),
          accuracy: Number(d.accuracy ?? 0),
          bestStreak: Number(d.bestStreak ?? 0),
          avgResponseMs: Number(d.avgResponseMs ?? 0),
          qpm: Number(d.qpm ?? 0),
          allowNegatives: Boolean(d.allowNegatives),
          createdAtMs: timestampToMs(d.createdAt),
          source: 'cloud',
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onSessions(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeLeaderboard(
  onEntries: (entries: LeaderboardRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};
  const path = 'leaderboard';
  const q = query(
    collection(db, 'leaderboard'),
    where('isPublic', '==', true),
    limit(150)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: LeaderboardRecord[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: String(d.id ?? docSnap.id),
          userId: String(d.userId ?? ''),
          displayName: String(d.displayName ?? 'Speedster'),
          mode: d.mode as ArithmeticMode,
          difficulty: d.difficulty as Difficulty,
          sessionType: d.sessionType as SessionType,
          durationSec: Number(d.durationSec ?? 0),
          score: Number(d.score ?? 0),
          accuracy: Number(d.accuracy ?? 0),
          bestStreak: Number(d.bestStreak ?? 0),
          avgResponseMs: Number(d.avgResponseMs ?? 0),
          qpm: Number(d.qpm ?? 0),
          isHidden: Boolean(d.isHidden),
          isFlagged: Boolean(d.isFlagged),
          flagReason: typeof d.flagReason === 'string' ? d.flagReason : '',
          updatedAtMs: timestampToMs(d.updatedAt ?? d.createdAt),
        };
      });
      entries.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
        return a.avgResponseMs - b.avgResponseMs;
      });
      onEntries(entries);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
