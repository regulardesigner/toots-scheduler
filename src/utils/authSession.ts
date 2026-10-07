import { normalizeUrl } from './url';

/** localStorage key holding the whole session as one JSON object. */
export const AUTH_STORAGE_KEY = 'mastodon_auth';

/** Keys used before 0.14.0, one value each and no activity time. */
const LEGACY_KEYS = ['mastodon_token', 'mastodon_instance', 'mastodon_client_id', 'mastodon_client_secret'] as const;

/** An activity time this far in the future can't be trusted (clock corrected, or tampering). */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/** A signed-in session as persisted in localStorage. */
export interface StoredAuth {
  instance: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  /** Epoch milliseconds of the last user activity; null for a session saved before 0.14.0. */
  lastActivityAt: number | null;
}

function isStoredAuth(value: unknown): value is StoredAuth {
  if (typeof value !== 'object' || value === null) return false;
  const session = value as Record<string, unknown>;
  return ['instance', 'clientId', 'clientSecret', 'accessToken'].every(
    key => typeof session[key] === 'string' && session[key] !== '',
  ) && (session.lastActivityAt === null || typeof session.lastActivityAt === 'number');
}

/** The token only ever goes to a normalized HTTPS origin (http for localhost in dev only). */
function hasSecureInstance(session: StoredAuth): boolean {
  try {
    return normalizeUrl(session.instance) === session.instance;
  } catch {
    return false;
  }
}

/**
 * Parses a raw `mastodon_auth` value, e.g. from a `storage` event.
 * @param {string | null} raw - The stored JSON string.
 * @returns {StoredAuth | null} The session, or null when missing or malformed.
 */
export function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isStoredAuth(value) && hasSecureInstance(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Reads the persisted session, including one saved by a version older than 0.14.0. Malformed,
 * incomplete or non-HTTPS data is erased and reported as no session.
 * @returns {StoredAuth | null} The session, or null when there is none.
 */
export function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  let session: StoredAuth | null = null;

  if (raw !== null) {
    session = parseStoredAuth(raw);
  } else {
    const [accessToken, instance, clientId, clientSecret] = LEGACY_KEYS.map(key => localStorage.getItem(key));
    if (accessToken && instance && clientId && clientSecret) {
      const legacy: StoredAuth = { instance, clientId, clientSecret, accessToken, lastActivityAt: null };
      session = hasSecureInstance(legacy) ? legacy : null;
    } else if (!accessToken && !instance && !clientId && !clientSecret) {
      return null;
    }
  }

  // Whatever is stored but unusable (malformed, incomplete, insecure) is erased, never retried.
  if (!session) clearStoredAuth();
  return session;
}

/**
 * Persists the session under the single `mastodon_auth` key and removes the legacy keys.
 * @param {StoredAuth} session - The session to save.
 */
export function writeStoredAuth(session: StoredAuth): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}

/**
 * Removes every trace of the session from localStorage, legacy keys included.
 */
export function clearStoredAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
}

/**
 * Tells whether a session must end for inactivity. A session without a recorded
 * activity (legacy or corrupted) is expired, and so is one more than 5 minutes in the future;
 * a smaller clock skew is tolerated.
 * @param {number | null} lastActivityAt - Epoch ms of the last activity.
 * @param {number} now - Current epoch ms.
 * @param {number} duration - Allowed inactivity in ms.
 * @returns {boolean} True when the session is expired.
 */
export function isSessionExpired(lastActivityAt: number | null, now: number, duration: number): boolean {
  if (lastActivityAt === null || !Number.isFinite(lastActivityAt)) return true;
  if (lastActivityAt - now > MAX_CLOCK_SKEW_MS) return true;
  return now - lastActivityAt >= duration;
}
