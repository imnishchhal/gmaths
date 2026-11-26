import { CustomPreset } from '../types/math';
import {
  AgentProfile,
  AppGlobalConfig,
  DEFAULT_APP_CONFIG,
  OfflineVoucher,
  PayoutRequest,
  ReferralCodePublic,
  StudentSubscription,
  TrialLead,
} from '../types/platform';

const PRESETS_PREFIX = 'gmaths_custom_presets_v1_';
const ADAPTIVE_COUNT_PREFIX = 'gmaths_free_adaptive_v1_';
const FALLBACK_KEY = 'gmaths_local_growth_db_v1';

export interface LocalGrowthState {
  agents: AgentProfile[];
  referralCodes: Record<string, ReferralCodePublic>;
  leads: TrialLead[];
  studentSubscriptions: StudentSubscription[];
  payoutRequests: PayoutRequest[];
  vouchers: OfflineVoucher[];
  appConfig: AppGlobalConfig;
}

function safeScope(scopeKey?: string): string {
  return (scopeKey || 'guest').replace(/[^a-zA-Z0-9_@.-]/g, '_').slice(0, 64);
}

export function loadCustomPresets(scopeKey?: string): CustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${PRESETS_PREFIX}${safeScope(scopeKey)}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomPresetItem(
  scopeKey: string | undefined,
  preset: CustomPreset
): CustomPreset[] {
  const existing = loadCustomPresets(scopeKey).filter((p) => p.id !== preset.id);
  const next = [preset, ...existing].slice(0, 12);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        `${PRESETS_PREFIX}${safeScope(scopeKey)}`,
        JSON.stringify(next)
      );
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function deleteCustomPresetItem(
  scopeKey: string | undefined,
  presetId: string
): CustomPreset[] {
  const next = loadCustomPresets(scopeKey).filter((p) => p.id !== presetId);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        `${PRESETS_PREFIX}${safeScope(scopeKey)}`,
        JSON.stringify(next)
      );
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function getFreeAdaptiveUsedCount(scopeKey?: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(
      `${ADAPTIVE_COUNT_PREFIX}${safeScope(scopeKey)}`
    );
    const num = Number(raw ?? '0');
    return Number.isFinite(num) && num >= 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function incrementFreeAdaptiveUsedCount(scopeKey?: string): number {
  const next = getFreeAdaptiveUsedCount(scopeKey) + 1;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        `${ADAPTIVE_COUNT_PREFIX}${safeScope(scopeKey)}`,
        String(next)
      );
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function loadLocalGrowthState(): LocalGrowthState {
  const empty: LocalGrowthState = {
    agents: [],
    referralCodes: {},
    leads: [],
    studentSubscriptions: [],
    payoutRequests: [],
    vouchers: [],
    appConfig: DEFAULT_APP_CONFIG,
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = window.localStorage.getItem(FALLBACK_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<LocalGrowthState>;
    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      referralCodes:
        parsed.referralCodes && typeof parsed.referralCodes === 'object'
          ? parsed.referralCodes
          : {},
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      studentSubscriptions: Array.isArray(parsed.studentSubscriptions)
        ? parsed.studentSubscriptions
        : [],
      payoutRequests: Array.isArray(parsed.payoutRequests)
        ? parsed.payoutRequests
        : [],
      vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
      appConfig: parsed.appConfig ?? DEFAULT_APP_CONFIG,
    };
  } catch {
    return empty;
  }
}

export function saveLocalGrowthState(state: LocalGrowthState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
