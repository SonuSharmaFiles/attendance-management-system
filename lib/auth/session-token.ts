import { EMPLOYEE_SESSION_TTL_SECONDS } from '@/lib/config';

/**
 * Signing and verification for employee session tokens.
 *
 * Deliberately free of any Next.js imports so the crypto can be unit tested on
 * its own — see tests/auth.test.ts. Cookie handling lives in employee-session.ts.
 *
 * The payload is SIGNED, not encrypted (HMAC-SHA256 via Web Crypto, so it runs
 * in both the Node and Edge runtimes). It carries no secrets — only an id the
 * holder already knows — but it cannot be forged or edited without the key.
 */

export interface EmployeeSession {
  /** Employee row id (uuid). */
  sub: string;
  /** Computer code, used to confirm the URL matches the session. */
  code: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.EMPLOYEE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'EMPLOYEE_SESSION_SECRET is missing or too short. Set a random value of at least 32 characters.',
    );
  }
  return new TextEncoder().encode(secret);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    getSecret() as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createSessionToken(
  session: Omit<EmployeeSession, 'exp'>,
  ttlSeconds = EMPLOYEE_SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: EmployeeSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Returns the session only if the signature is valid and it has not expired. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<EmployeeSession | null> {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  let valid: boolean;
  try {
    const key = await importKey();
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature) as unknown as ArrayBuffer,
      new TextEncoder().encode(encoded),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const session = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encoded)),
    ) as EmployeeSession;
    if (!session.sub || !session.code || typeof session.exp !== 'number') return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
