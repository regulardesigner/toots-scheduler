import { getRedirectUri, OAUTH_SCOPES } from '../config/constants';

const PENDING_LOGIN_KEY = 'mastodon_oauth_pending';

/** What the login form must remember until the OAuth callback. Kept in sessionStorage: this tab only. */
export interface PendingLogin {
  instance: string;
  clientId: string;
  clientSecret: string;
  state: string;
  codeVerifier: string;
}

/**
 * Remembers a login in progress until the instance redirects back.
 * @param {PendingLogin} pending - The login in progress.
 */
export function savePendingLogin(pending: PendingLogin): void {
  sessionStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify(pending));
}

/**
 * Returns the login in progress and forgets it, so its state and verifier are used only once.
 * @returns {PendingLogin | null} The pending login, or null if there is none or it is malformed.
 */
export function takePendingLogin(): PendingLogin | null {
  const raw = sessionStorage.getItem(PENDING_LOGIN_KEY);
  sessionStorage.removeItem(PENDING_LOGIN_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<PendingLogin>;
    const fields = [value.instance, value.clientId, value.clientSecret, value.state, value.codeVerifier];
    return fields.every(field => typeof field === 'string' && field !== '') ? (value as PendingLogin) : null;
  } catch {
    return null;
  }
}

/**
 * Builds the instance's authorization URL, with CSRF `state` and a PKCE S256 challenge.
 * @param {string} instance - The instance origin.
 * @param {string} clientId - The registered app's client ID.
 * @param {string} state - The random state to check on the callback.
 * @param {string} codeChallenge - The PKCE challenge.
 * @returns {string} The URL to send the user to.
 */
export function buildAuthorizeUrl(instance: string, clientId: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${instance}/oauth/authorize?${params.toString()}`;
}

/**
 * Reads the OAuth callback query string and returns the authorization code.
 * @param {string} search - `window.location.search` on the callback page.
 * @param {string} expectedState - The state saved when the login started.
 * @returns {string} The authorization code.
 * @throws {Error} If access was denied, the state does not match (possible CSRF), or there is no code.
 */
export function readAuthorizationCode(search: string, expectedState: string): string {
  const params = new URLSearchParams(search);
  const error = params.get('error');
  if (error) {
    throw new Error(error === 'access_denied'
      ? 'You cancelled the authorization on your instance.'
      : 'Your instance refused the authorization. Please try again.');
  }
  if (params.get('state') !== expectedState) {
    throw new Error('This sign-in link is invalid or has expired. Please sign in again.');
  }
  const code = params.get('code');
  if (!code) {
    throw new Error('No authorization code found');
  }
  return code;
}
