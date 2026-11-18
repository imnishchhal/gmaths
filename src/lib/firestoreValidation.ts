/**
 * Defensive payload sanitization and validation helpers synchronized verbatim
 * with firebase-blueprint.json and firestore.rules.
 */

import {
  ArithmeticMode,
  Difficulty,
  SessionRecord,
  SessionType,
} from '../types/math';

export const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const MAX_ID_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_EMAIL_LENGTH = 120;

export const ALLOWED_MODES: readonly ArithmeticMode[] = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
  'mixed',
];

export const ALLOWED_DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
];

export const ALLOWED_SESSION_TYPES: readonly SessionType[] = [
  'sprint',
  'streak',
  'practice',
];

export function isValidFirestoreId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= MAX_ID_LENGTH &&
    ID_REGEX.test(id)
  );
}

export function sanitizeId(raw: string, fallbackPrefix = 'id'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, MAX_ID_LENGTH);
  if (cleaned.length > 0 && ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now()}`;
}

export function sanitizeDisplayName(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Speedster';
  return trimmed.slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function sanitizeEmail(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().slice(0, MAX_EMAIL_LENGTH);
  return trimmed.length >= 3 ? trimmed : 'user@local.invalid';
}

export function buildLeaderboardEntryId(
  userId: string,
  mode: ArithmeticMode,
  difficulty: Difficulty,
  sessionType: SessionType,
  durationSec: number
): string {
  const normalizedDuration = sessionType === 'sprint' ? Math.round(durationSec) : 0;
  return `${userId}_${mode}_${difficulty}_${sessionType}_${normalizedDuration}`;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampFloat(value: number, min: number, max: number, decimals = 1): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  const factor = Math.pow(10, decimals);
  return Math.round(clamped * factor) / factor;
}

export interface SanitizedSessionPayload {
  id: string;
  userId: string;
  mode: ArithmeticMode;
  difficulty: Difficulty;
  sessionType: SessionType;
  durationSec: number;
  elapsedSec: number;
  score: number;
  attempted: number;
  correct: number;
  accuracy: number;
  bestStreak: number;
  avgResponseMs: number;
  qpm: number;
  allowNegatives: boolean;
}

/**
 * Guarantees a session payload conforms strictly to every bound and invariant
 * declared in firebase-blueprint.json and enforced by firestore.rules.
 */
export function sanitizeSessionPayload(
  userId: string,
  session: SessionRecord
): SanitizedSessionPayload {
  const safeUserId = sanitizeId(userId, 'u');
  const safeId = sanitizeId(session.id, 's');
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

  const durationSec =
    sessionType === 'sprint' ? clampInt(session.durationSec, 0, 3600) : 0;
  const elapsedSec = clampFloat(session.elapsedSec, 0, 7200, 1);
  const score = clampInt(session.score, 0, 5000);
  const attempted = Math.max(score, clampInt(session.attempted, 0, 10000));
  const correct = score;
  const accuracy =
    attempted > 0
      ? clampFloat((correct / attempted) * 100, 0, 100, 1)
      : clampFloat(session.accuracy, 0, 100, 1);
  const bestStreak = clampInt(Math.min(session.bestStreak, score), 0, score);
  const avgResponseMs = clampInt(session.avgResponseMs, 0, 600000);
  const qpm = clampFloat(session.qpm, 0, 600, 1);

  return {
    id: safeId,
    userId: safeUserId,
    mode,
    difficulty,
    sessionType,
    durationSec,
    elapsedSec,
    score,
    attempted,
    correct,
    accuracy,
    bestStreak,
    avgResponseMs,
    qpm,
    allowNegatives: Boolean(session.allowNegatives),
  };
}
