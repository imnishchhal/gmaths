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

export const INDIAN_CLASSES = [
  'Nursery',
  'LKG',
  'UKG',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
] as const;

export type IndianClass = (typeof INDIAN_CLASSES)[number];

export type SessionType = 'sprint' | 'streak' | 'practice';

export type SprintDuration = 30 | 60 | 90;

export type AppView = 'play' | 'history' | 'leaderboard' | 'stats';

export type GameState = 'SETUP' | 'PLAYING' | 'SUMMARY';

export type DrillVariant = 'standard' | 'weak_spots' | 'daily_challenge';

export interface CustomPreset {
  id: string;
  name: string;
  mode: ArithmeticMode;
  difficulty?: Difficulty;
  indianClass: IndianClass;
  sessionType: SessionType;
  durationSec: SprintDuration;
  allowNegatives: boolean;
  autoSubmit: boolean;
  createdAtMs: number;
}

export interface DrillConfig {
  mode: ArithmeticMode;
  difficulty: Difficulty;
  indianClass: IndianClass;
  sessionType: SessionType;
  durationSec: SprintDuration;
  allowNegatives: boolean;
  autoSubmit: boolean;
  drillVariant?: DrillVariant;
  dailySeed?: string;
  adaptiveQueue?: MathProblem[];
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
  grade?: IndianClass;
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
  drillVariant?: DrillVariant;
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
  isHidden?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
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

export interface IndianClassCurriculum {
  label: IndianClass;
  fullLabel: string;
  stage: string;
  allowedOperations: ConcreteOperation[];
  allowNegativesAvailable: boolean;
  mappedDifficulty: Difficulty;
  rangeSummary: string;
  recommendedDuration: SprintDuration;
}

export const INDIAN_CLASS_META: Record<IndianClass, IndianClassCurriculum> = {
  Nursery: {
    label: 'Nursery',
    fullLabel: 'Nursery',
    stage: 'Pre-Primary',
    allowedOperations: ['addition'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Counting addition 1–5',
    recommendedDuration: 60,
  },
  LKG: {
    label: 'LKG',
    fullLabel: 'LKG',
    stage: 'Pre-Primary',
    allowedOperations: ['addition', 'subtraction'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Single-digit Add & Sub (1–9)',
    recommendedDuration: 60,
  },
  UKG: {
    label: 'UKG',
    fullLabel: 'UKG',
    stage: 'Pre-Primary',
    allowedOperations: ['addition', 'subtraction'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Add & Sub up to 15',
    recommendedDuration: 60,
  },
  '1st': {
    label: '1st',
    fullLabel: 'Class 1st',
    stage: 'Primary',
    allowedOperations: ['addition', 'subtraction'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Add & Sub 1–20',
    recommendedDuration: 60,
  },
  '2nd': {
    label: '2nd',
    fullLabel: 'Class 2nd',
    stage: 'Primary',
    allowedOperations: ['addition', 'subtraction', 'multiplication'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Add/Sub 2–50 · Tables 2–5',
    recommendedDuration: 60,
  },
  '3rd': {
    label: '3rd',
    fullLabel: 'Class 3rd',
    stage: 'Primary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'easy',
    rangeSummary: 'Add/Sub 5–99 · Mul/Div tables 2–9',
    recommendedDuration: 60,
  },
  '4th': {
    label: '4th',
    fullLabel: 'Class 4th',
    stage: 'Primary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'medium',
    rangeSummary: 'Add/Sub 10–150 · Mul/Div tables 2–12',
    recommendedDuration: 60,
  },
  '5th': {
    label: '5th',
    fullLabel: 'Class 5th',
    stage: 'Primary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: false,
    mappedDifficulty: 'medium',
    rangeSummary: 'Add/Sub 15–250 · Mul/Div up to 15 × 12',
    recommendedDuration: 60,
  },
  '6th': {
    label: '6th',
    fullLabel: 'Class 6th',
    stage: 'Middle',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'medium',
    rangeSummary: 'Add/Sub 20–300 · Mul/Div up to 18 × 12 · Integers',
    recommendedDuration: 60,
  },
  '7th': {
    label: '7th',
    fullLabel: 'Class 7th',
    stage: 'Middle',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'medium',
    rangeSummary: 'Add/Sub 25–400 · Mul/Div up to 20 × 15 · Integers',
    recommendedDuration: 60,
  },
  '8th': {
    label: '8th',
    fullLabel: 'Class 8th',
    stage: 'Middle',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'hard',
    rangeSummary: 'Add/Sub 30–500 · Mul/Div up to 25 × 15',
    recommendedDuration: 90,
  },
  '9th': {
    label: '9th',
    fullLabel: 'Class 9th',
    stage: 'Secondary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'hard',
    rangeSummary: 'Add/Sub 40–650 · Mul/Div up to 25 × 19',
    recommendedDuration: 90,
  },
  '10th': {
    label: '10th',
    fullLabel: 'Class 10th',
    stage: 'Secondary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'hard',
    rangeSummary: 'Add/Sub 50–750 · Mul/Div up to 29 × 19',
    recommendedDuration: 90,
  },
  '11th': {
    label: '11th',
    fullLabel: 'Class 11th',
    stage: 'Senior Secondary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'hard',
    rangeSummary: 'Add/Sub 75–999 · Mul/Div up to 35 × 20',
    recommendedDuration: 90,
  },
  '12th': {
    label: '12th',
    fullLabel: 'Class 12th',
    stage: 'Senior Secondary',
    allowedOperations: ['addition', 'subtraction', 'multiplication', 'division'],
    allowNegativesAvailable: true,
    mappedDifficulty: 'hard',
    rangeSummary: 'Add/Sub 99–1200 · Mul/Div up to 45 × 25',
    recommendedDuration: 90,
  },
};

export function isIndianClass(val: unknown): val is IndianClass {
  return (
    typeof val === 'string' &&
    (INDIAN_CLASSES as readonly string[]).includes(val)
  );
}

export function normalizeIndianClass(
  raw?: string | null,
  fallback: IndianClass = '3rd'
): IndianClass {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (isIndianClass(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower.includes('nurs')) return 'Nursery';
  if (lower === 'lkg' || lower.includes('lower kg') || lower.includes('jr')) {
    return 'LKG';
  }
  if (lower === 'ukg' || lower.includes('upper kg') || lower.includes('sr')) {
    return 'UKG';
  }
  const numMatch = /(\d{1,2})/.exec(lower);
  if (numMatch) {
    const n = Number(numMatch[1]);
    const ordinalMap: Record<number, IndianClass> = {
      1: '1st',
      2: '2nd',
      3: '3rd',
      4: '4th',
      5: '5th',
      6: '6th',
      7: '7th',
      8: '8th',
      9: '9th',
      10: '10th',
      11: '11th',
      12: '12th',
    };
    if (ordinalMap[n]) return ordinalMap[n];
  }
  return fallback;
}

export function formatIndianClassLabel(cls: IndianClass): string {
  return INDIAN_CLASS_META[cls].fullLabel;
}

export function getAllowedModesForClass(cls: IndianClass): ArithmeticMode[] {
  const ops = INDIAN_CLASS_META[cls].allowedOperations;
  if (ops.length <= 1) {
    return [...ops];
  }
  return ['mixed', ...ops];
}

export function coerceModeForClass(
  mode: ArithmeticMode,
  cls: IndianClass
): ArithmeticMode {
  const allowed = getAllowedModesForClass(cls);
  return allowed.includes(mode) ? mode : allowed[0];
}

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
  durationSec: number,
  indianClass?: IndianClass
): string {
  const timerPart =
    sessionType === 'sprint'
      ? `${durationSec}s Sprint`
      : sessionType === 'streak'
      ? 'Streak Run'
      : 'Practice';
  const levelPart = indianClass
    ? formatIndianClassLabel(indianClass)
    : DIFFICULTY_META[difficulty].label;
  return `${MODE_META[mode].label} · ${levelPart} · ${timerPart}`;
}
