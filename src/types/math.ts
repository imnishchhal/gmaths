export type ArithmeticMode =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division'
  | 'mixed';

export type ConcreteOperation =
  | 'addition'
  | 'subtraction'
  | 'multiplication'
  | 'division';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type SessionType = 'sprint' | 'streak' | 'practice';

export type SprintDuration = 30 | 60 | 90;

export type AppView = 'play' | 'history' | 'leaderboard' | 'stats';

export type GameState = 'SETUP' | 'PLAYING' | 'SUMMARY';

export interface DrillConfig {
  mode: ArithmeticMode;
  difficulty: Difficulty;
  sessionType: SessionType;
  durationSec: SprintDuration;
  allowNegatives: boolean;
  autoSubmit: boolean;
}

export interface MathProblem {
  id: string;
  operandA: number;
  operandB: number;
  operation: ConcreteOperation;
  symbol: '+' | '−' | '×' | '÷';
  answer: number;
  signature: string;
  presentedAt: number;
}

export interface AttemptLog {
  problemId: string;
  expression: string;
  operation: ConcreteOperation;
  expected: number;
  userAnswer: string;
  outcome: 'correct' | 'wrong' | 'skipped';
  responseMs: number;
}

export interface SessionRecord {
  id: string;
  userId?: string;
  mode: ArithmeticMode;
  difficulty: Difficulty;
  sessionType: SessionType;
  /** 0 for untimed modes (streak/practice); 30/60/90 for timed sprint */
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
  createdAtMs: number;
  source: 'cloud' | 'local';
  attempts?: AttemptLog[];
}

export interface LeaderboardRecord {
  id: string;
  userId: string;
  displayName: string;
  mode: ArithmeticMode;
  difficulty: Difficulty;
  sessionType: SessionType;
  durationSec: number;
  score: number;
  accuracy: number;
  bestStreak: number;
  avgResponseMs: number;
  qpm: number;
  updatedAtMs: number;
}

export const MODE_META: Record<
  ArithmeticMode,
  { label: string; shortLabel: string; symbol: string }
> = {
  mixed: { label: 'Mixed', shortLabel: 'Mixed', symbol: '+−×÷' },
  addition: { label: 'Addition', shortLabel: 'Add', symbol: '+' },
  subtraction: { label: 'Subtraction', shortLabel: 'Sub', symbol: '−' },
  multiplication: { label: 'Multiplication', shortLabel: 'Mul', symbol: '×' },
  division: { label: 'Division', shortLabel: 'Div', symbol: '÷' },
};

export const DIFFICULTY_META: Record<
  Difficulty,
  {
    label: string;
    rangeSummary: string;
    recommendedDuration: SprintDuration;
  }
> = {
  easy: {
    label: 'Easy',
    rangeSummary: 'Add/Sub 1–20 · Mul/Div tables 2–9',
    recommendedDuration: 60,
  },
  medium: {
    label: 'Medium',
    rangeSummary: 'Add/Sub 10–99 · Mul/Div up to 15 × 12',
    recommendedDuration: 60,
  },
  hard: {
    label: 'Hard',
    rangeSummary: 'Add/Sub 25–499 · Mul/Div up to 29 × 19',
    recommendedDuration: 90,
  },
};

export const SESSION_TYPE_META: Record<
  SessionType,
  { label: string; description: string }
> = {
  sprint: {
    label: 'Timed Sprint',
    description: 'Solve as many problems as possible before the clock hits zero.',
  },
  streak: {
    label: 'Streak Run',
    description: 'Sudden-death endurance. One mistake ends the run.',
  },
  practice: {
    label: 'Practice',
    description: 'Untimed flow. Drill at your own pace and finish whenever ready.',
  },
};

export function getPresetKey(
  mode: ArithmeticMode,
  difficulty: Difficulty,
  sessionType: SessionType,
  durationSec: number
): string {
  const effectiveDuration = sessionType === 'sprint' ? durationSec : 0;
  return `${mode}_${difficulty}_${sessionType}_${effectiveDuration}`;
}

export function formatSessionDescriptor(
  mode: ArithmeticMode,
  difficulty: Difficulty,
  sessionType: SessionType,
  durationSec: number
): string {
  const timerPart =
    sessionType === 'sprint'
      ? `${durationSec}s Sprint`
      : sessionType === 'streak'
      ? 'Streak Run'
      : 'Practice';
  return `${MODE_META[mode].label} · ${DIFFICULTY_META[difficulty].label} · ${timerPart}`;
}
