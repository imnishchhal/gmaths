import { hashSecret } from './crypto';

const REFERRAL_STORAGE_KEY = 'gmaths_sticky_referral_v1';
const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface StoredReferral {
  code: string;
  capturedAtMs: number;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_\-]/g, '').slice(0, 32);
}

export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export const normalizePhoneForMatch = normalizePhoneDigits;

export function normalizeEmailLower(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

export const normalizeEmailForMatch = normalizeEmailLower;

export function buildAgentAuthEmail(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 7) return '';
  return `agent.${digits}@gmaths.local`;
}

export function isPhoneAgentAuthEmail(
  email: string | null | undefined
): boolean {
  const clean = normalizeEmailLower(email);
  return /^agent\.[0-9]{7,15}@gmaths\.local$/.test(clean);
}

export async function hashContactForAttribution(raw: string): Promise<string> {
  if (!raw.trim()) return '';
  return hashSecret(raw.trim().toLowerCase());
}

/**
 * Extracts ?ref=CODE from URL search params or hash query string.
 */
export function extractReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('ref');
    if (fromSearch) {
      const clean = normalizeReferralCode(fromSearch);
      if (clean.length >= 2) return clean;
    }

    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx >= 0) {
      const hashParams = new URLSearchParams(hash.slice(qIdx + 1));
      const fromHash = hashParams.get('ref');
      if (fromHash) {
        const clean = normalizeReferralCode(fromHash);
        if (clean.length >= 2) return clean;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function saveStickyReferral(code: string): StoredReferral | null {
  const clean = normalizeReferralCode(code);
  if (clean.length < 2) return null;
  const payload: StoredReferral = {
    code: clean,
    capturedAtMs: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
  }
  return payload;
}

export function loadStickyReferral(): StoredReferral | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredReferral>;
    if (
      !parsed ||
      typeof parsed.code !== 'string' ||
      typeof parsed.capturedAtMs !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.capturedAtMs > REFERRAL_TTL_MS) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    const clean = normalizeReferralCode(parsed.code);
    return clean.length >= 2
      ? { code: clean, capturedAtMs: parsed.capturedAtMs }
      : null;
  } catch {
    return null;
  }
}

export function captureReferralFromCurrentUrl(): string | null {
  const fromUrl = extractReferralFromUrl();
  if (fromUrl) {
    saveStickyReferral(fromUrl);
    return fromUrl;
  }
  return loadStickyReferral()?.code ?? null;
}

export function buildAgentReferralUrl(agentCode: string): string {
  const clean = normalizeReferralCode(agentCode);
  if (typeof window === 'undefined') {
    return `?ref=${clean}`;
  }
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = `?ref=${encodeURIComponent(clean)}`;
  return url.toString();
}

export function buildWhatsAppPitchUrl(agentName: string, agentCode: string): string {
  const trackingLink = buildAgentReferralUrl(agentCode);
  const message =
    `Hi! Boost your child's mental math speed & accuracy (Nursery to Class 12th) with Math Speedster.\n\n` +
    `Use my partner code *${normalizeReferralCode(agentCode)}* to get ₹100 OFF the Annual Pro Plan (₹1,100 instead of ₹1,200/yr) including weak-spot drills & detailed progress insights:\n` +
    `${trackingLink}\n\n` +
    `— ${agentName}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
