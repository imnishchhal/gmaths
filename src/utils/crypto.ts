/**
 * Client-side SHA-256 hashing for Agent/Parent/Child passcodes & PINs.
 * Uses Web Crypto API when available (HTTPS / localhost) with a deterministic
 * pure-JS fallback so mobile devices on non-secure local networks never fail.
 */

const SALT = 'gmaths_v1_cred_salt::';

function fallbackHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ (ch + i), 2246822519);
    h4 = Math.imul(h4 ^ (ch * 31), 3266489917);
  }

  const parts = [h1, h2, h3, h4].map((n) =>
    (n >>> 0).toString(16).padStart(8, '0')
  );
  return `fb_${parts.join('')}`;
}

export async function hashSecret(raw: string): Promise<string> {
  const normalized = `${SALT}${raw.trim()}`;
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    try {
      const encoded = new TextEncoder().encode(normalized);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return fallbackHash(normalized);
    }
  }
  return fallbackHash(normalized);
}

export async function verifySecret(
  raw: string,
  storedHash: string
): Promise<boolean> {
  const computed = await hashSecret(raw);
  if (computed === storedHash) return true;
  // Also check fallback hash in case credential was created in non-HTTPS dev context
  return fallbackHash(`${SALT}${raw.trim()}`) === storedHash;
}
