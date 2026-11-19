import {
  ArithmeticMode,
  ConcreteOperation,
  Difficulty,
  SessionType,
} from './math';

export type UserRole = 'admin' | 'agent' | 'parent' | 'child';

export type PaymentMethod = 'cash' | 'upi' | 'bank';

export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export type ComputedSubscriptionState =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended';

export type PlatformRoute = '/' | '/admin' | '/agent' | '/parent' | '/child';

export interface AgentProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  agentCode: string;
  name: string;
  phone: string;
  email: string;
  assignedArea: string;
  commissionRate: number;
  defaultYearlyFee: number;
  passcodeHash: string;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ParentProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  name: string;
  contact: string;
  passcodeHash: string;
  createdByAgentId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ChildProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  parentId: string;
  createdByAgentId: string;
  name: string;
  age: number;
  grade: string;
  username: string;
  pinHash: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SubscriptionRecord {
  id: string;
  workspaceId: string;
  ownerUid: string;
  parentId: string;
  planType: 'yearly';
  /** ISO calendar date YYYY-MM-DD */
  startDate: string;
  /** ISO calendar date YYYY-MM-DD (Start Date + 1 Year) */
  expiryDate: string;
  feeAmount: number;
  paymentMethod: PaymentMethod;
  receiptNote: string;
  collectedByAgentId: string;
  status: SubscriptionStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export type WeakTopic = 'none' | ConcreteOperation;

export interface PracticeSession {
  id: string;
  workspaceId: string;
  ownerUid: string;
  childId: string;
  parentId: string;
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
  weakTopic: WeakTopic;
  createdAtMs: number;
}

export interface RoleSession {
  role: UserRole;
  accountId: string;
  displayName: string;
  /** Set when a Parent uses "Switch to Child Mode" so they can jump straight back */
  returnToParentId?: string;
}

export interface ChildOnboardingInput {
  name: string;
  age: number;
  grade: string;
  username: string;
  pin: string;
}

export const WORKSPACE_ID = 'gmaths_main';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'kumarnishchhal175@gmail.com';
export const LOCAL_ADMIN_DEFAULT_EMAIL = 'admin@gmaths.app';

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Adds exactly 1 calendar year to an ISO date string (YYYY-MM-DD), handling leap years cleanly.
 */
export function addOneYearIso(startDateIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDateIso);
  if (!match) {
    return addOneYearIso(todayIsoDate());
  }
  const year = Number(match[1]) + 1;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maxDayInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, maxDayInMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

export function daysUntilExpiry(expiryDateIso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiryDateIso);
  if (!match) return -1;
  const expiry = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    23,
    59,
    59
  );
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = expiry.getTime() - todayStart.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function evaluateSubscriptionState(
  sub: SubscriptionRecord | undefined
): {
  state: ComputedSubscriptionState;
  daysLeft: number;
  label: string;
  canPractice: boolean;
} {
  if (!sub) {
    return {
      state: 'expired',
      daysLeft: -1,
      label: 'No Active Plan',
      canPractice: false,
    };
  }
  if (sub.status === 'suspended') {
    return {
      state: 'suspended',
      daysLeft: daysUntilExpiry(sub.expiryDate),
      label: 'Suspended',
      canPractice: false,
    };
  }
  const daysLeft = daysUntilExpiry(sub.expiryDate);
  if (sub.status === 'expired' || daysLeft < 0) {
    return {
      state: 'expired',
      daysLeft,
      label: 'Expired',
      canPractice: false,
    };
  }
  if (daysLeft <= 30) {
    return {
      state: 'expiring_soon',
      daysLeft,
      label: 'Expiring Soon',
      canPractice: true,
    };
  }
  return {
    state: 'active',
    daysLeft,
    label: 'Active',
    canPractice: true,
  };
}

export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  try {
    const dt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(dt);
  } catch {
    return iso;
  }
}

export function formatCurrency(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `₹${Math.round(safe)}`;
  }
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank: 'Bank Transfer',
};
