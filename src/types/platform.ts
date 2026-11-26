import {
  ArithmeticMode,
  ConcreteOperation,
  Difficulty,
  IndianClass,
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

/** Credential-free child switching happens directly from /parent — no separate /child login route */
export type PlatformRoute = '/' | '/admin' | '/agent' | '/parent';

export type AgentApprovalStatus = 'pending' | 'approved' | 'suspended';

export interface AgentProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  agentCode: string;
  name: string;
  phone: string;
  /** Required lowercase Google Sign-In email for cross-device Firestore access */
  email: string;
  assignedArea: string;
  city?: string;
  upiId?: string;
  approvalStatus?: AgentApprovalStatus;
  /** Percentage rate for cash family renewals/collections */
  commissionRate: number;
  /** Flat INR commission per ₹1,200/₹1,100 referral conversion (0/undefined = standard ₹300 -> ₹350 tier) */
  commissionPerConversion?: number;
  defaultYearlyFee: number;
  passcodeHash: string;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ReferralCodePublic {
  code: string;
  workspaceId: string;
  agentId: string;
  agentName: string;
  isActive: boolean;
  approvalStatus: AgentApprovalStatus;
  emailHash: string;
  phoneHash: string;
  updatedAtMs: number;
}

export interface ParentProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  name: string;
  contact: string;
  /** Lowercase Google Sign-In email for cross-device Parent access */
  email: string;
  passcodeHash: string;
  createdByAgentId: string;
  /** Denormalized agent metadata so Parents see renewal contact directly without cross-collection reads */
  agentEmail: string;
  agentName: string;
  agentPhone: string;
  agentArea: string;
  agentCode: string;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Credential-free student profile (no username, password, or PIN) */
export interface ChildProfile {
  id: string;
  workspaceId: string;
  ownerUid: string;
  parentId: string;
  createdByAgentId: string;
  parentEmail: string;
  agentEmail: string;
  name: string;
  grade: IndianClass;
  totalScore: number;
  sessionsCount: number;
  bestStreak: number;
  createdAtMs: number;
  updatedAtMs: number;
}

/** Public zero-PII child ranking record backing Home Page Top 3 Math Champions */
export interface ChildLeaderboardEntry {
  id: string;
  childId: string;
  workspaceId: string;
  ownerUid: string;
  name: string;
  grade: IndianClass;
  totalScore: number;
  sessionsCount: number;
  bestStreak: number;
  isPublic: true;
  isHidden?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface SubscriptionRecord {
  id: string;
  workspaceId: string;
  ownerUid: string;
  parentId: string;
  parentEmail: string;
  agentEmail: string;
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

export interface TrialLead {
  id: string;
  workspaceId: string;
  ownerUid: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  agentId: string;
  agentEmail: string;
  status: 'trial' | 'converted';
  createdAtMs: number;
  updatedAtMs: number;
}

export type StudentPaymentMethod = 'upi' | 'card' | 'voucher';

export interface StudentSubscription {
  id: string;
  workspaceId: string;
  ownerUid: string;
  subscriberName: string;
  subscriberEmail: string;
  subscriberPhone: string;
  planType: 'yearly';
  startDate: string;
  expiryDate: string;
  amountPaid: number;
  discountApplied: number;
  paymentMethod: StudentPaymentMethod;
  referralCode: string;
  attributedAgentId: string;
  agentEmail: string;
  voucherCode: string;
  commissionAmount: number;
  status: SubscriptionStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface PayoutRequest {
  id: string;
  workspaceId: string;
  ownerUid: string;
  agentId: string;
  agentEmail: string;
  agentName: string;
  upiId: string;
  amount: number;
  status: 'pending' | 'paid';
  utrNumber: string;
  createdAtMs: number;
  updatedAtMs: number;
  paidAt: string;
}

export interface OfflineVoucher {
  id: string;
  code: string;
  workspaceId: string;
  ownerUid: string;
  agentId: string;
  agentEmail: string;
  agentName: string;
  planAmount: number;
  status: 'unused' | 'redeemed';
  redeemedByUid: string;
  redeemedByEmail: string;
  createdAtMs: number;
  redeemedAt: string;
}

export interface AppGlobalConfig {
  id: string;
  dailyChallengeSeed: string;
  announcementEnabled: boolean;
  announcementText: string;
  updatedAtMs: number;
}

export type WeakTopic = 'none' | ConcreteOperation;

export interface PracticeSession {
  id: string;
  workspaceId: string;
  ownerUid: string;
  childId: string;
  parentId: string;
  parentEmail: string;
  agentEmail: string;
  grade: IndianClass;
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
  /** Set when a Parent launches a child via one-tap switching */
  returnToParentId?: string;
}

/** Simplified child onboarding: ONLY Name and Indian Class/Grade */
export interface ChildOnboardingInput {
  name: string;
  grade: IndianClass;
}

export const WORKSPACE_ID = 'gmaths_main';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'kumarnishchhal175@gmail.com';
export const ANNUAL_PLAN_PRICE_INR = 1200;
export const REFERRAL_DISCOUNT_INR = 100;
export const AGENT_BASE_COMMISSION_INR = 300;
export const AGENT_TIER2_COMMISSION_INR = 350;
export const AGENT_TIER2_THRESHOLD = 10;
export const PAYOUT_MINIMUM_INR = 500;
export const ANTI_CHEAT_MIN_AVG_MS = 150;

export function getAgentApprovalStatus(
  agent: Pick<AgentProfile, 'approvalStatus' | 'isActive'>
): AgentApprovalStatus {
  if (agent.approvalStatus) return agent.approvalStatus;
  return agent.isActive ? 'approved' : 'suspended';
}

export function isSameCalendarMonth(tsMs: number, refDate = new Date()): boolean {
  const dt = new Date(tsMs);
  return (
    dt.getFullYear() === refDate.getFullYear() &&
    dt.getMonth() === refDate.getMonth()
  );
}

export function getCommissionForNextConversion(
  agent: Pick<AgentProfile, 'commissionPerConversion'>,
  monthlyConversionsCountBeforeThis: number
): number {
  const custom = Number(agent.commissionPerConversion ?? 0);
  if (custom > 0) return Math.round(custom);
  return monthlyConversionsCountBeforeThis >= AGENT_TIER2_THRESHOLD
    ? AGENT_TIER2_COMMISSION_INR
    : AGENT_BASE_COMMISSION_INR;
}

export interface AgentCommissionSummary {
  totalConversions: number;
  monthConversions: number;
  currentRatePerConversion: number;
  totalEarned: number;
  pendingPayouts: number;
  paidOut: number;
  availableBalance: number;
}

export function computeAgentCommissionSummary(
  agent: AgentProfile,
  studentSubs: StudentSubscription[],
  familySubs: SubscriptionRecord[],
  payouts: PayoutRequest[]
): AgentCommissionSummary {
  const myStudentSubs = studentSubs.filter(
    (s) => s.attributedAgentId === agent.id && s.status === 'active'
  );
  const myFamilySubs = familySubs.filter(
    (s) => s.collectedByAgentId === agent.id && s.status === 'active'
  );
  const allMonthCount =
    myStudentSubs.filter((s) => isSameCalendarMonth(s.createdAtMs)).length +
    myFamilySubs.filter((s) => isSameCalendarMonth(s.createdAtMs)).length;

  const referralEarned = myStudentSubs.reduce(
    (sum, s) => sum + (Number(s.commissionAmount) || AGENT_BASE_COMMISSION_INR),
    0
  );
  const familyEarned = myFamilySubs.reduce((sum, s) => {
    const customFlat = Number(agent.commissionPerConversion ?? 0);
    if (customFlat > 0) return sum + customFlat;
    const pctEarned = Math.round(((s.feeAmount || 0) * (agent.commissionRate || 0)) / 100);
    return sum + pctEarned;
  }, 0);

  const totalEarned = referralEarned + familyEarned;
  const myPayouts = payouts.filter((p) => p.agentId === agent.id);
  const pendingPayouts = myPayouts
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);
  const paidOut = myPayouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);
  const availableBalance = Math.max(0, totalEarned - pendingPayouts - paidOut);

  return {
    totalConversions: myStudentSubs.length + myFamilySubs.length,
    monthConversions: allMonthCount,
    currentRatePerConversion: getCommissionForNextConversion(agent, allMonthCount),
    totalEarned,
    pendingPayouts,
    paidOut,
    availableBalance,
  };
}

export function isSuspiciousSpeedRun(
  avgResponseMs: number,
  score: number
): boolean {
  return score >= 3 && avgResponseMs > 0 && avgResponseMs < ANTI_CHEAT_MIN_AVG_MS;
}

export function isStudentSubscriptionActive(
  sub: StudentSubscription | undefined
): boolean {
  if (!sub || sub.status !== 'active') return false;
  return daysUntilExpiry(sub.expiryDate) >= 0;
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_APP_CONFIG: AppGlobalConfig = {
  id: 'global',
  dailyChallengeSeed: `daily-${todayIsoDate()}`,
  announcementEnabled: false,
  announcementText: '',
  updatedAtMs: 0,
};

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
