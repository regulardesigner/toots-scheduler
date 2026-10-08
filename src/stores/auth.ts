import axios from 'axios';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MastodonAccount } from '../types/mastodon';
import { ACTIVITY_WRITE_INTERVAL_MS, SESSION_DURATION_MS } from '../config/constants';
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  isSessionExpired,
  parseStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type StoredAuth,
} from '../utils/authSession';

/** Why a session ended without the user clicking "Logout", so the UI can explain it. */
export type SessionEndReason = 'inactivity' | 'unauthorized';

/** Credentials obtained at the end of the OAuth flow. */
export type LoginCredentials = Omit<StoredAuth, 'lastActivityAt'>;

const REVOKE_TIMEOUT_MS = 5000;
const VERIFY_TIMEOUT_MS = 10000;

/**
 * Revokes the access token on the instance, so a copied token stops working too.
 * Best effort: a failure (offline, instance down) must never block the local logout.
 * @param {StoredAuth} session - The session whose token is revoked.
 */
async function revokeToken(session: StoredAuth): Promise<void> {
  try {
    await axios.post(
      `${session.instance}/oauth/revoke`,
      new URLSearchParams({
        client_id: session.clientId,
        client_secret: session.clientSecret,
        token: session.accessToken,
      }),
      { timeout: REVOKE_TIMEOUT_MS },
    );
  } catch {
    // Ignored on purpose, see above.
  }
}

/**
 * Creates a Pinia store for authentication.
 * The session lives in localStorage and ends after SESSION_DURATION_MS of inactivity,
 * even when the tab was closed in between. The store never navigates: the app reacts
 * to `accessToken` and `sessionEndReason`.
 * @returns {Object} The authentication store with state and actions.
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const account = ref<MastodonAccount | null>(null);
  const instance = ref<string | null>(null);
  const clientId = ref<string | null>(null);
  const clientSecret = ref<string | null>(null);
  const lastActivityAt = ref<number | null>(null);
  const sessionEndReason = ref<SessionEndReason | null>(null);

  function applySession(session: StoredAuth): void {
    instance.value = session.instance;
    clientId.value = session.clientId;
    clientSecret.value = session.clientSecret;
    accessToken.value = session.accessToken;
    lastActivityAt.value = session.lastActivityAt;
  }

  function currentSession(): StoredAuth | null {
    if (!instance.value || !clientId.value || !clientSecret.value || !accessToken.value) return null;
    return {
      instance: instance.value,
      clientId: clientId.value,
      clientSecret: clientSecret.value,
      accessToken: accessToken.value,
      lastActivityAt: lastActivityAt.value,
    };
  }

  function clearLocalSession(): void {
    accessToken.value = null;
    account.value = null;
    instance.value = null;
    clientId.value = null;
    clientSecret.value = null;
    lastActivityAt.value = null;
  }

  /**
   * Starts a session at the end of the OAuth flow.
   * @param {LoginCredentials} credentials - Instance, client and access token.
   */
  function completeLogin(credentials: LoginCredentials): void {
    applySession({ ...credentials, lastActivityAt: Date.now() });
    sessionEndReason.value = null;
    writeStoredAuth(currentSession() as StoredAuth);
  }

  /**
   * Sets the user account data.
   * @param {MastodonAccount} accountData - The account data.
   */
  function setAccount(accountData: MastodonAccount): void {
    account.value = accountData;
  }

  /**
   * Records user activity. It is persisted at most every ACTIVITY_WRITE_INTERVAL_MS,
   * which is enough for other tabs and later visits to see it.
   * @param {number} [now] - Current epoch ms.
   */
  function recordActivity(now: number = Date.now()): void {
    const session = currentSession();
    if (!session) return;

    // A timer that fired late (sleep, throttling) must not let activity revive an expired session.
    if (isSessionExpired(session.lastActivityAt, now, SESSION_DURATION_MS)) {
      void expireIfIdle(now);
      return;
    }

    if (session.lastActivityAt !== null && now - session.lastActivityAt < ACTIVITY_WRITE_INTERVAL_MS) return;

    // Another tab may have logged out or switched account before its storage event reached us:
    // never write back a session that is no longer the stored one.
    const stored = parseStoredAuth(localStorage.getItem(AUTH_STORAGE_KEY));
    if (!stored || stored.accessToken !== session.accessToken) {
      if (stored) adoptSession(stored);
      else clearLocalSession();
      return;
    }

    lastActivityAt.value = now;
    writeStoredAuth({ ...session, lastActivityAt: now });
  }

  /**
   * Ends the session: clears it locally and in every tab, then revokes the token (best effort).
   * @param {Object} [options]
   * @param {boolean} [options.revoke] - Revoke the token on the instance (default true).
   * @param {SessionEndReason} [options.reason] - Why the session ended, when it is not a manual logout.
   */
  async function logout(options: { revoke?: boolean; reason?: SessionEndReason } = {}): Promise<void> {
    const session = currentSession();
    clearLocalSession();
    clearStoredAuth();
    sessionEndReason.value = options.reason ?? null;

    if (session && options.revoke !== false) {
      await revokeToken(session);
    }
  }

  /**
   * Ends the session after the instance rejected the token (401). No revoke: it is already invalid.
   */
  async function handleUnauthorized(): Promise<void> {
    if (!accessToken.value) return;
    await logout({ revoke: false, reason: 'unauthorized' });
  }

  /**
   * Forgets the session end reason once the UI has shown it.
   */
  function acknowledgeSessionEnd(): void {
    sessionEndReason.value = null;
  }

  /**
   * Loads the account for a session, unless the session changed meanwhile.
   * Only a rejected token (401) ends the session; being offline must not.
   * @param {StoredAuth} session - The session to verify.
   */
  async function loadAccount(session: StoredAuth): Promise<void> {
    try {
      const response = await axios.get(`${session.instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        timeout: VERIFY_TIMEOUT_MS,
      });
      if (accessToken.value === session.accessToken) account.value = response.data;
    } catch (error) {
      if (accessToken.value !== session.accessToken) return;
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await logout({ revoke: false, reason: 'unauthorized' });
      }
    }
  }

  /**
   * Switches this tab to the session another tab stored, reloading the account if it changed.
   * @param {StoredAuth} session - The stored session.
   */
  function adoptSession(session: StoredAuth): void {
    const switchedAccount = session.accessToken !== accessToken.value;
    applySession(session);
    if (switchedAccount) {
      account.value = null;
      void loadAccount(session);
    }
  }

  /**
   * Ends the session for inactivity, unless another tab kept it alive meanwhile
   * (its storage event may not have reached this tab yet).
   * @param {number} [now] - Current epoch ms.
   */
  async function expireIfIdle(now: number = Date.now()): Promise<void> {
    if (!accessToken.value) return;
    const stored = parseStoredAuth(localStorage.getItem(AUTH_STORAGE_KEY));
    if (stored && !isSessionExpired(stored.lastActivityAt, now, SESSION_DURATION_MS)) {
      adoptSession(stored);
      return;
    }
    await logout({ reason: 'inactivity' });
  }

  /**
   * Restores the saved session. An expired one (including any pre-0.14.0 session) is
   * revoked and removed before its token is used for anything else.
   */
  async function initializeFromStorage(): Promise<void> {
    const session = readStoredAuth();
    if (!session) return;

    if (isSessionExpired(session.lastActivityAt, Date.now(), SESSION_DURATION_MS)) {
      clearStoredAuth();
      sessionEndReason.value = 'inactivity';
      await revokeToken(session);
      return;
    }

    applySession(session);
    await loadAccount(session);
  }

  /**
   * Keeps tabs in sync: a logout elsewhere logs this tab out, and activity elsewhere keeps it alive.
   * @param {StorageEvent} event - Fired by the browser when another tab changes localStorage.
   */
  function handleStorageEvent(event: StorageEvent): void {
    if (event.key !== AUTH_STORAGE_KEY && event.key !== null) return;

    const session = event.key === null ? null : parseStoredAuth(event.newValue);
    if (!session) {
      clearLocalSession();
      return;
    }
    adoptSession(session);
  }

  window.addEventListener('storage', handleStorageEvent);
  initializeFromStorage();

  return {
    accessToken,
    account,
    instance,
    clientId,
    clientSecret,
    lastActivityAt,
    sessionEndReason,
    completeLogin,
    setAccount,
    recordActivity,
    expireIfIdle,
    logout,
    handleUnauthorized,
    acknowledgeSessionEnd,
  };
});
