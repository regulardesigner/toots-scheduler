# Lot 2 — Auth & OAuth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signing in is CSRF-proof and PKCE-protected, only HTTPS instances are accepted, the token is revoked on logout and really expires after 30 minutes of inactivity (closed tab included), every tab stays in sync, and a rejected token ends the session cleanly.

**Architecture:**
- **Login state:** the OAuth pending login (`state`, PKCE verifier, client credentials) lives in `sessionStorage` until the callback, which uses it once.
- **Session:** the signed-in session lives in one `mastodon_auth` localStorage entry with a `lastActivityAt` timestamp. The rewritten auth store checks it on startup and revokes expired sessions. The store also follows other tabs through the `storage` event, and it never navigates or toasts: `App.vue` reacts to `accessToken` and `sessionEndReason`.
- **Inactivity timer:** `useSessionTimeout` computes its timers from `lastActivityAt`.
- **HTTP client:** the client attaches the token only on an exact origin match, and turns a 401 from the instance into a clean sign-out.

**Tech Stack:** Vue 3.5, Pinia 2 setup stores, TypeScript 5.7 (lib ES2022), axios 1.20, WebCrypto (`crypto.getRandomValues`, `crypto.subtle.digest`), Vitest 4 + happy-dom.

**User Verification:** YES. The spec asks for a check on a real Mastodon instance at the end of Lot 2: full login (state + PKCE), token revoked after logout, expiry after a closed tab, multi-tab logout. Task 10 is the gate.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 2: SEC-02, SEC-03, SEC-04, SEC-04b, SEC-05, SEC-06, SEC-08, SEC-09, CC-05, WEB-03, plus the deferred "keep the error `cause`" item. Decisions:
- **D1 = option A:** localStorage, a real 30-min inactivity expiry, revocation, 100% static (no backend).
- **D2:** keep `client_secret`, which `/oauth/revoke` needs.

---

## Context the engineer needs

- **Branch:** `fix/lot-2-auth-hardening` is stacked on `fix/lot-1-data-integrity` (PR #39), which sits on `chore/lot-0-quality-gate` (PR #38). Open the PR against `fix/lot-1-data-integrity`.
- **Quality commands:**
  - `npm run lint`: 0 errors. The warning count only goes down: 7 → 5.
  - `npm run typecheck` (`vue-tsc -b`).
  - `npm test`.
  - `npm run build`.

  Tests sit next to their source as `*.test.ts`, and each test file imports `describe/it/expect/vi` from `'vitest'` explicitly.
- **Project skills:** read `.claude/skills/vue3-codegen/SKILL.md`, `.claude/skills/mastodon-api/SKILL.md` and `.claude/skills/web-security/SKILL.md` before coding. Read `.claude/skills/changelog/SKILL.md` for Task 9.
- **Mastodon facts, verified on docs.joinmastodon.org/methods/oauth and in `config/initializers/cors.rb`:**
  - `GET /oauth/authorize` accepts `state`, `code_challenge` and `code_challenge_method=S256`, with PKCE added in Mastodon 4.3.0. Older instances ignore the PKCE parameters, so login keeps working there with `state` only.
  - A denied authorization redirects with `?error=access_denied` (standard Doorkeeper behaviour).
  - `POST /oauth/token` accepts `code_verifier`.
  - `POST /oauth/revoke` takes `client_id`, `client_secret` and `token`, and returns `{}`.
  - CORS allows POST on `/oauth/token` and `/oauth/revoke`.
- **PKCE test vector:** RFC 7636 appendix B. The verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` gives the challenge `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`.
- **WebCrypto in tests:** `crypto.subtle.digest` resolves outside the microtask queue, so `flushPromises()` is not enough after a hash. Wait for the effect itself with `await vi.waitFor(...)`.
- **In tests, `import.meta.env.BASE_URL` is `/`, not `/toots-scheduler/`:** build expected URLs from it.
- **Every code block below was dry-run on a scratch copy of this branch:** 136 tests passed at plan time, typecheck was clean, lint showed 0 errors and 5 warnings, and the production build contained no `console.` call. After the review hardening (see the self-review notes), the branch has 160 tests.

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/utils/url.ts` (+ test) | Rewrite | Instance address → HTTPS origin (accepts a bare domain) |
| `src/components/Auth/LoginForm.vue` | Modify | Text input for a bare domain (T1); PKCE/state login (T5) |
| `src/utils/pkce.ts` (+ test) | Create | Random tokens, S256 challenge |
| `src/config/constants.ts` | Create | OAuth scopes, redirect URI, session durations |
| `src/utils/oauthFlow.ts` (+ test) | Create | Pending login (sessionStorage), authorize URL, callback parsing |
| `src/utils/authSession.ts` (+ test) | Create | `mastodon_auth` persistence, legacy keys, `isSessionExpired` |
| `src/stores/auth.ts` (+ test) | Rewrite | Session lifecycle: login, restore/expire, activity, revoke, tabs, 401 |
| `src/components/OAuthCallback.vue` (+ test) | Modify | State check, PKCE exchange, URL cleanup |
| `src/App.vue` | Modify | Leave protected pages, toast why a session ended |
| `src/composables/useMastodonApi.ts` (+ test) | Modify | OAuth calls (T5); axios upload + error `cause` (T7) |
| `src/composables/useSessionTimeout.ts` (+ test) | Rewrite | Inactivity timers from `lastActivityAt` |
| `src/utils/api.ts` (+ test) | Rewrite | Exact-origin token attach, 401 → sign-out |
| `src/utils/error.ts`, `tsconfig.app.json` | Modify | `unknown` errors; ES2022 lib for `cause` |
| `vite.config.ts`, `README.md` | Modify | No console in production; Security section |
| `package.json`, `package-lock.json`, `src/stores/features.ts` | Modify | Release 0.14.0 |

Task order matters: each task leaves `npm run typecheck` and `npm test` green.

---

### Task 1: HTTPS-only instance address that accepts a bare domain (SEC-05)

**Goal:** `normalizeUrl` returns the HTTPS origin of what the user typed. It accepts `mastodon.social`, refuses `http://` (except a local instance in dev), other schemes and credentials. The login field lets the user type a bare domain.

**Files:**
- Rewrite: `src/utils/url.ts`
- Modify: `src/utils/url.test.ts`
- Modify: `src/components/Auth/LoginForm.vue` (the `<input id="instance">` only)

**Acceptance Criteria:**
- [ ] `normalizeUrl('mastodon.social')` → `https://mastodon.social`
- [ ] `normalizeUrl('http://mastodon.social', false)` throws `The instance address must use https://`
- [ ] `http://localhost:3000` is accepted only when the second argument is true (the default is `import.meta.env.DEV`)
- [ ] `javascript:alert(1)` and `https://user:pass@host` throw `Invalid URL format`
- [ ] The login input is `type="text"` with no `pattern`, so a bare domain can be submitted
- [ ] The 3 existing `normalizeUrl` tests still pass

**Verify:** `npx vitest run src/utils/url.test.ts` → `Tests  8 passed (8)`

**Steps:**

- [ ] **Step 1: Write the failing tests:** replace the whole of `src/utils/url.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('returns only the origin of a valid URL', () => {
    expect(normalizeUrl('https://mastodon.social/@dams?tab=1#x')).toBe('https://mastodon.social');
  });

  it('drops a trailing slash', () => {
    expect(normalizeUrl('https://mastodon.social/')).toBe('https://mastodon.social');
  });

  it('throws on a string that is not a URL', () => {
    expect(() => normalizeUrl('not a url')).toThrow('Invalid URL format');
  });

  it('accepts a bare domain and surrounding spaces', () => {
    expect(normalizeUrl('  mastodon.social ')).toBe('https://mastodon.social');
    expect(normalizeUrl('mastodon.social/@dams')).toBe('https://mastodon.social');
  });

  it('keeps a non-default port', () => {
    expect(normalizeUrl('https://masto.example:8443/')).toBe('https://masto.example:8443');
  });

  it('refuses plain http', () => {
    expect(() => normalizeUrl('http://mastodon.social', false)).toThrow('The instance address must use https://');
  });

  it('allows http only for a local instance when local http is allowed', () => {
    expect(normalizeUrl('http://localhost:3000', true)).toBe('http://localhost:3000');
    expect(() => normalizeUrl('http://localhost:3000', false)).toThrow('The instance address must use https://');
    expect(() => normalizeUrl('http://mastodon.social', true)).toThrow('The instance address must use https://');
  });

  it('refuses other schemes and credentials in the address', () => {
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('Invalid URL format');
    expect(() => normalizeUrl('ftp://mastodon.social')).toThrow('The instance address must use https://');
    expect(() => normalizeUrl('https://user:pass@mastodon.social')).toThrow('Invalid URL format');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/url.test.ts`
Expected: the 5 new tests FAIL. The bare domain throws `Invalid URL format`, and http is accepted. The 3 existing tests pass.

- [ ] **Step 3: Write the implementation:** replace the whole of `src/utils/url.ts` with:

```ts
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Validates an instance address typed by the user and returns its origin.
 * Accepts "mastodon.social" as well as "https://mastodon.social/@me". Only HTTPS is
 * accepted, since the access token would otherwise travel in clear text, except for a
 * local instance during development.
 * @param {string} input - What the user typed.
 * @param {boolean} [allowLocalHttp] - Allow http://localhost; defaults to dev mode only.
 * @returns {string} The instance origin, e.g. https://mastodon.social.
 * @throws {Error} If the address is invalid or does not use HTTPS.
 */
export function normalizeUrl(input: string, allowLocalHttp: boolean = import.meta.env.DEV): string {
  const value = input.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Invalid URL format');
  }

  const isLocalHttp = parsed.protocol === 'http:' && allowLocalHttp && LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('The instance address must use https://');
  }

  return parsed.origin;
}
```

- [ ] **Step 4: Let the login field accept a bare domain**

In `src/components/Auth/LoginForm.vue`, replace:

```html
        <label for="instance">Enter your instance URL</label>
        <input
          id="instance"
          v-model="instance"
          type="url"
          placeholder="https://mastodon.social"
          required
          pattern="https?://.*"
          :disabled="isLoading"
        >
```

with:

```html
        <label for="instance">Enter your instance address</label>
        <input
          id="instance"
          v-model="instance"
          type="text"
          inputmode="url"
          autocapitalize="none"
          autocomplete="url"
          spellcheck="false"
          placeholder="mastodon.social"
          required
          :disabled="isLoading"
        >
```

Why: `type="url"` and the `pattern` made the browser reject `mastodon.social` before the app could normalize it. Validation now happens in `normalizeUrl`, and the error is shown in the form.

- [ ] **Step 5: Verify**

Run: `npx vitest run src/utils/url.test.ts` → `Tests  8 passed (8)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`
Run: `npm test` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/utils/url.ts src/utils/url.test.ts src/components/Auth/LoginForm.vue
git commit -m "fix(auth): accept only HTTPS instances, allow a bare domain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/url.ts", "src/utils/url.test.ts", "src/components/Auth/LoginForm.vue"], "verifyCommand": "npx vitest run src/utils/url.test.ts", "acceptanceCriteria": ["bare domain → https origin", "http refused (local http only when allowed)", "other schemes and credentials refused", "login input accepts a bare domain", "existing tests pass"], "requiresUserVerification": false}
```

---

### Task 2: PKCE and random-token helpers

**Goal:** Pure WebCrypto helpers create URL-safe random tokens (for `state` and the verifier) and the S256 challenge, checked against the RFC 7636 vector.

**Files:**
- Create: `src/utils/pkce.ts`
- Test: `src/utils/pkce.test.ts`

**Acceptance Criteria:**
- [ ] `createCodeChallenge` returns `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM` for the RFC 7636 appendix B verifier
- [ ] `createRandomToken()` returns 43 base64url characters, different on each call
- [ ] `createPkcePair()` returns a verifier and its matching challenge

**Verify:** `npx vitest run src/utils/pkce.test.ts` → `Tests  3 passed (3)`

**Steps:**

- [ ] **Step 1: Write the failing test:** create `src/utils/pkce.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createCodeChallenge, createPkcePair, createRandomToken } from './pkce';

describe('pkce', () => {
  it('computes the RFC 7636 appendix B challenge', async () => {
    await expect(createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates 43-character base64url tokens that differ each time', () => {
    const a = createRandomToken();
    const b = createRandomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).not.toBe(a);
  });

  it('creates a verifier with its matching challenge', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(createCodeChallenge(verifier)).resolves.toBe(challenge);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/pkce.test.ts`
Expected: FAIL with `Failed to resolve import "./pkce"`.

- [ ] **Step 3: Write the implementation:** create `src/utils/pkce.ts`:

```ts
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Returns a URL-safe random string, used for the OAuth `state` and the PKCE verifier.
 * @param {number} [byteLength] - Random bytes to draw; 32 bytes give 43 characters.
 * @returns {string} A base64url string.
 */
export function createRandomToken(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/**
 * Computes the S256 PKCE challenge of a verifier (RFC 7636 §4.2).
 * @param {string} verifier - The PKCE code verifier.
 * @returns {Promise<string>} base64url(SHA-256(verifier)).
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** A PKCE verifier, kept by the app, and its challenge, sent to the instance. */
export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * Creates a fresh PKCE verifier and its S256 challenge.
 * @returns {Promise<PkcePair>} The pair.
 */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = createRandomToken();
  return { verifier, challenge: await createCodeChallenge(verifier) };
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/utils/pkce.test.ts` → `Tests  3 passed (3)`

- [ ] **Step 5: Commit**

```bash
git add src/utils/pkce.ts src/utils/pkce.test.ts
git commit -m "feat(auth): add PKCE S256 and random token helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/pkce.ts", "src/utils/pkce.test.ts"], "verifyCommand": "npx vitest run src/utils/pkce.test.ts", "acceptanceCriteria": ["RFC 7636 vector matches", "43-char base64url random tokens", "verifier/challenge pair matches"], "requiresUserVerification": false}
```

---

### Task 3: OAuth flow helpers (pending login, authorize URL, callback) and shared constants

**Goal:** Pure, tested helpers carry a login from the form to the callback. The pending login is kept in `sessionStorage` and used once. The authorize URL carries `state` and PKCE. The callback is parsed with a state check and a clear message on denial.

**Files:**
- Create: `src/config/constants.ts`
- Create: `src/utils/oauthFlow.ts`
- Test: `src/utils/oauthFlow.test.ts`

**Acceptance Criteria:**
- [ ] `takePendingLogin()` returns the saved login once, then `null`. The login sits in `sessionStorage`, never in `localStorage`. Malformed or incomplete values give `null`
- [ ] `buildAuthorizeUrl` sends `response_type`, `client_id`, `redirect_uri`, the minimal `scope`, `state`, `code_challenge` and `code_challenge_method=S256`
- [ ] `readAuthorizationCode`:
  - returns the code only when `state` matches;
  - throws `This sign-in link is invalid or has expired. Please sign in again.` when the state is missing or forged;
  - throws `You cancelled the authorization on your instance.` on `access_denied`;
  - throws `No authorization code found` when there is no code

**Verify:** `npx vitest run src/utils/oauthFlow.test.ts` → `Tests  8 passed (8)`

**Steps:**

- [ ] **Step 1: Create the shared constants:** create `src/config/constants.ts`:

```ts
/** OAuth scopes requested from the instance: the minimum this app needs. */
export const OAUTH_SCOPES = 'read:accounts read:statuses write:media write:statuses';

/**
 * OAuth callback URL, built from the page origin only (never from user input).
 * @returns {string} e.g. https://regulardesigner.github.io/toots-scheduler/oauth/callback
 */
export function getRedirectUri(): string {
  return window.location.origin + import.meta.env.BASE_URL + 'oauth/callback';
}

/** A session ends after this much inactivity, even if every tab was closed meanwhile. */
export const SESSION_DURATION_MS = 30 * 60 * 1000;

/** The "session will expire" warning shows this long before the end. */
export const SESSION_WARNING_MS = 5 * 60 * 1000;

/** User activity is written to storage at most this often. */
export const ACTIVITY_WRITE_INTERVAL_MS = 30 * 1000;
```

- [ ] **Step 2: Write the failing test:** create `src/utils/oauthFlow.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildAuthorizeUrl, readAuthorizationCode, savePendingLogin, takePendingLogin, type PendingLogin } from './oauthFlow';

const pending: PendingLogin = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  state: 'state-123',
  codeVerifier: 'verifier-456',
};

describe('oauthFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('pending login', () => {
    it('is returned once, then forgotten', () => {
      savePendingLogin(pending);
      expect(takePendingLogin()).toEqual(pending);
      expect(takePendingLogin()).toBeNull();
    });

    it('is kept in sessionStorage, not localStorage', () => {
      savePendingLogin(pending);
      expect(localStorage.getItem('mastodon_oauth_pending')).toBeNull();
      expect(sessionStorage.getItem('mastodon_oauth_pending')).not.toBeNull();
    });

    it('is null when missing, malformed or incomplete', () => {
      expect(takePendingLogin()).toBeNull();
      sessionStorage.setItem('mastodon_oauth_pending', '{not json');
      expect(takePendingLogin()).toBeNull();
      sessionStorage.setItem('mastodon_oauth_pending', JSON.stringify({ ...pending, codeVerifier: '' }));
      expect(takePendingLogin()).toBeNull();
    });
  });

  describe('buildAuthorizeUrl', () => {
    it('sends state and a PKCE S256 challenge with the minimal scopes', () => {
      const url = new URL(buildAuthorizeUrl('https://masto.example', 'client-id', 'state-123', 'challenge-789'));

      expect(url.origin + url.pathname).toBe('https://masto.example/oauth/authorize');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        response_type: 'code',
        client_id: 'client-id',
        redirect_uri: `${window.location.origin}${import.meta.env.BASE_URL}oauth/callback`,
        scope: 'read:accounts read:statuses write:media write:statuses',
        state: 'state-123',
        code_challenge: 'challenge-789',
        code_challenge_method: 'S256',
      });
    });
  });

  describe('readAuthorizationCode', () => {
    it('returns the code when the state matches', () => {
      expect(readAuthorizationCode('?code=abc&state=state-123', 'state-123')).toBe('abc');
    });

    it('rejects a mismatched or missing state', () => {
      expect(() => readAuthorizationCode('?code=abc&state=forged', 'state-123'))
        .toThrow('This sign-in link is invalid or has expired. Please sign in again.');
      expect(() => readAuthorizationCode('?code=abc', 'state-123'))
        .toThrow('This sign-in link is invalid or has expired. Please sign in again.');
    });

    it('explains a denied authorization', () => {
      expect(() => readAuthorizationCode('?error=access_denied&state=state-123', 'state-123'))
        .toThrow('You cancelled the authorization on your instance.');
      expect(() => readAuthorizationCode('?error=server_error', 'state-123'))
        .toThrow('Your instance refused the authorization. Please try again.');
    });

    it('rejects a callback without a code', () => {
      expect(() => readAuthorizationCode('?state=state-123', 'state-123')).toThrow('No authorization code found');
    });
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run src/utils/oauthFlow.test.ts`
Expected: FAIL with `Failed to resolve import "./oauthFlow"`.

- [ ] **Step 4: Write the implementation:** create `src/utils/oauthFlow.ts`:

```ts
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
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/utils/oauthFlow.test.ts` → `Tests  8 passed (8)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`

- [ ] **Step 6: Commit**

```bash
git add src/config/constants.ts src/utils/oauthFlow.ts src/utils/oauthFlow.test.ts
git commit -m "feat(auth): add OAuth state/PKCE flow helpers and shared constants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/config/constants.ts", "src/utils/oauthFlow.ts", "src/utils/oauthFlow.test.ts"], "verifyCommand": "npx vitest run src/utils/oauthFlow.test.ts", "acceptanceCriteria": ["pending login in sessionStorage, single use", "authorize URL with state + S256 challenge + minimal scopes", "callback: state checked, denial explained, missing code rejected"], "requiresUserVerification": false}
```

---

### Task 4: Session persistence: one `mastodon_auth` key, legacy keys, `isSessionExpired`

**Goal:** A pure, tested module persists the session as one JSON value with `lastActivityAt`, reads pre-0.14.0 sessions (four separate keys, no activity time), and decides expiry.

**Files:**
- Create: `src/utils/authSession.ts`
- Test: `src/utils/authSession.test.ts`

**Acceptance Criteria:**
- [ ] `isSessionExpired`: false at 29 min, true at 30 and 31 min, true for `null` or `NaN`, false when the clock moved backwards
- [ ] `writeStoredAuth` writes only `mastodon_auth` and removes the legacy keys. `clearStoredAuth` removes both
- [ ] `readStoredAuth` returns a legacy session with `lastActivityAt: null`, and `null` for missing, malformed or incomplete data

**Verify:** `npx vitest run src/utils/authSession.test.ts` → `Tests  7 passed (7)`

**Steps:**

- [ ] **Step 1: Write the failing test:** create `src/utils/authSession.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  clearStoredAuth,
  isSessionExpired,
  parseStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type StoredAuth,
} from './authSession';

const MINUTE = 60 * 1000;

const session: StoredAuth = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  accessToken: 'token',
  lastActivityAt: 1_000_000,
};

function setLegacyKeys(): void {
  localStorage.setItem('mastodon_token', 'legacy-token');
  localStorage.setItem('mastodon_instance', 'https://masto.example');
  localStorage.setItem('mastodon_client_id', 'legacy-id');
  localStorage.setItem('mastodon_client_secret', 'legacy-secret');
}

describe('authSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('isSessionExpired', () => {
    it('is false within the allowed inactivity and true from its end', () => {
      expect(isSessionExpired(0, 29 * MINUTE, 30 * MINUTE)).toBe(false);
      expect(isSessionExpired(0, 30 * MINUTE, 30 * MINUTE)).toBe(true);
      expect(isSessionExpired(0, 31 * MINUTE, 30 * MINUTE)).toBe(true);
    });

    it('treats a missing or invalid activity time as expired', () => {
      expect(isSessionExpired(null, 0, 30 * MINUTE)).toBe(true);
      expect(isSessionExpired(NaN, 0, 30 * MINUTE)).toBe(true);
    });

    it('does not expire when the clock moved backwards', () => {
      expect(isSessionExpired(10 * MINUTE, 0, 30 * MINUTE)).toBe(false);
    });
  });

  describe('storage', () => {
    it('round-trips the session under a single key', () => {
      writeStoredAuth(session);
      expect(Object.keys(localStorage)).toEqual([AUTH_STORAGE_KEY]);
      expect(readStoredAuth()).toEqual(session);
    });

    it('reads a pre-0.14.0 session from the legacy keys, without an activity time', () => {
      setLegacyKeys();
      expect(readStoredAuth()).toEqual({
        instance: 'https://masto.example',
        clientId: 'legacy-id',
        clientSecret: 'legacy-secret',
        accessToken: 'legacy-token',
        lastActivityAt: null,
      });
    });

    it('removes the legacy keys when writing or clearing', () => {
      setLegacyKeys();
      writeStoredAuth(session);
      expect(localStorage.getItem('mastodon_token')).toBeNull();

      setLegacyKeys();
      clearStoredAuth();
      expect(localStorage.length).toBe(0);
    });

    it('returns null for nothing, malformed JSON or an incomplete session', () => {
      expect(readStoredAuth()).toBeNull();
      expect(parseStoredAuth('{oops')).toBeNull();
      expect(parseStoredAuth(JSON.stringify({ ...session, accessToken: '' }))).toBeNull();
      expect(parseStoredAuth(JSON.stringify({ ...session, lastActivityAt: 'yesterday' }))).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/authSession.test.ts`
Expected: FAIL with `Failed to resolve import "./authSession"`.

- [ ] **Step 3: Write the implementation:** create `src/utils/authSession.ts`:

```ts
/** localStorage key holding the whole session as one JSON object. */
export const AUTH_STORAGE_KEY = 'mastodon_auth';

/** Keys used before 0.14.0, one value each and no activity time. */
const LEGACY_KEYS = ['mastodon_token', 'mastodon_instance', 'mastodon_client_id', 'mastodon_client_secret'] as const;

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

/**
 * Parses a raw `mastodon_auth` value, e.g. from a `storage` event.
 * @param {string | null} raw - The stored JSON string.
 * @returns {StoredAuth | null} The session, or null when missing or malformed.
 */
export function parseStoredAuth(raw: string | null): StoredAuth | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isStoredAuth(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Reads the persisted session, including one saved by a version older than 0.14.0.
 * @returns {StoredAuth | null} The session, or null when there is none.
 */
export function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (raw !== null) return parseStoredAuth(raw);

  const [accessToken, instance, clientId, clientSecret] = LEGACY_KEYS.map(key => localStorage.getItem(key));
  if (accessToken && instance && clientId && clientSecret) {
    return { instance, clientId, clientSecret, accessToken, lastActivityAt: null };
  }
  return null;
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
 * activity (legacy or corrupted) is expired; a clock moved backwards is not.
 * @param {number | null} lastActivityAt - Epoch ms of the last activity.
 * @param {number} now - Current epoch ms.
 * @param {number} duration - Allowed inactivity in ms.
 * @returns {boolean} True when the session is expired.
 */
export function isSessionExpired(lastActivityAt: number | null, now: number, duration: number): boolean {
  if (lastActivityAt === null || !Number.isFinite(lastActivityAt)) return true;
  return now - lastActivityAt >= duration;
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/utils/authSession.test.ts` → `Tests  7 passed (7)`

- [ ] **Step 5: Commit**

```bash
git add src/utils/authSession.ts src/utils/authSession.test.ts
git commit -m "feat(auth): persist the session under one key with its last activity time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/authSession.ts", "src/utils/authSession.test.ts"], "verifyCommand": "npx vitest run src/utils/authSession.test.ts", "acceptanceCriteria": ["isSessionExpired boundaries, null/NaN, clock skew", "single key, legacy keys removed", "legacy session read with null activity; malformed → null"], "requiresUserVerification": false}
```

---

### Task 5: Auth store rewrite, PKCE login, state-checked callback, App wiring (SEC-02, SEC-03, SEC-04, SEC-04b)

**Goal:** The session starts only after a state-checked PKCE exchange. On startup, an expired or legacy session is revoked before its token is used for anything else. Logout revokes the token. Every tab follows. The UI leaves protected pages and says why a session ended.

**Files:**
- Rewrite: `src/stores/auth.ts`
- Test: `src/stores/auth.test.ts`
- Modify: `src/components/Auth/LoginForm.vue` (whole `<script setup>`)
- Test: `src/components/Auth/LoginForm.test.ts`
- Modify: `src/components/OAuthCallback.vue` (whole `<script setup>`)
- Test: `src/components/OAuthCallback.test.ts`
- Modify: `src/composables/useMastodonApi.ts` (imports, `registerApplication`, `getAccessToken`, their JSDoc in the returned object)
- Modify: `src/App.vue` (imports, logout handler, two watchers)

**Acceptance Criteria:**
- [ ] The store no longer uses `useRouter` and no longer has `setAccessToken`, `setInstance` or `setClientCredentials`. It exposes:
  - state: `accessToken`, `account`, `instance`, `clientId`, `clientSecret`, `lastActivityAt`, `sessionEndReason`;
  - actions: `completeLogin`, `setAccount`, `recordActivity`, `logout`, `handleUnauthorized`, `acknowledgeSessionEnd`
- [ ] On startup:
  - a session idle for 30 min or more, or a pre-0.14.0 one, is revoked (`POST /oauth/revoke` with `client_id`, `client_secret`, `token`) and removed, with **no** `verify_credentials` call. `sessionEndReason` is set to `'inactivity'`;
  - a 401 on `verify_credentials` signs out without revoking (reason `'unauthorized'`);
  - a network error keeps the session
- [ ] Session lifecycle:
  - `logout()` revokes the token, and still clears everything locally if revocation fails;
  - `recordActivity` writes at most every 30 s;
  - a `storage` event removing `mastodon_auth` logs the tab out, and one carrying newer activity updates `lastActivityAt`
- [ ] Login and callback:
  - the login sends `state` and an S256 challenge;
  - the callback refuses a forged or missing state without exchanging the code, sends the verifier, saves the session and removes `?code=` from the URL
- [ ] `App.vue` sends the user home when `accessToken` becomes null on a protected route, and toasts the reason for `inactivity` and `unauthorized`
- [ ] `npm run typecheck` is clean and `npm test` passes (124 tests)

**Verify:** `npx vitest run src/stores/auth.test.ts src/components/Auth/LoginForm.test.ts src/components/OAuthCallback.test.ts` → `Tests  20 passed (20)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/stores/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  isAxiosError: (error: unknown) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
}));

vi.mock('axios', () => ({ default: http }));

import { useAuthStore } from './auth';

const MINUTE = 60 * 1000;
const NOW = new Date('2030-01-01T12:00:00.000Z').getTime();

const credentials = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  accessToken: 'token',
};

function storeSession(lastActivityAt: number | null): void {
  localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, lastActivityAt }));
}

function storedSession(): Record<string, unknown> | null {
  const raw = localStorage.getItem('mastodon_auth');
  return raw ? JSON.parse(raw) : null;
}

function expectRevoked(expected = { client_id: 'client-id', client_secret: 'client-secret', token: 'token' }): void {
  expect(http.post).toHaveBeenCalledTimes(1);
  const [url, body] = http.post.mock.calls[0];
  expect(url).toBe('https://masto.example/oauth/revoke');
  expect(Object.fromEntries(body as URLSearchParams)).toEqual(expected);
}

describe('auth store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    setActivePinia(createPinia());
    http.post.mockResolvedValue({ data: {} });
    http.get.mockResolvedValue({ data: { id: '1', acct: 'me' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('on startup', () => {
    it('does nothing without a saved session', async () => {
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBeNull();
      expect(http.get).not.toHaveBeenCalled();
    });

    it('restores a recent session and loads the account', async () => {
      storeSession(NOW - 10 * MINUTE);
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBe('token');
      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v1/accounts/verify_credentials', {
        headers: { Authorization: 'Bearer token' },
        timeout: 10000,
      });
      expect(auth.account).toEqual({ id: '1', acct: 'me' });
    });

    it('revokes and removes a session idle for 30 minutes, without using its token otherwise', async () => {
      storeSession(NOW - 31 * MINUTE);
      const auth = useAuthStore();
      await flushPromises();

      expectRevoked();
      expect(http.get).not.toHaveBeenCalled();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('inactivity');
      expect(localStorage.length).toBe(0);
    });

    it('treats a pre-0.14.0 session as expired and revokes its token', async () => {
      localStorage.setItem('mastodon_token', 'legacy-token');
      localStorage.setItem('mastodon_instance', 'https://masto.example');
      localStorage.setItem('mastodon_client_id', 'legacy-id');
      localStorage.setItem('mastodon_client_secret', 'legacy-secret');
      const auth = useAuthStore();
      await flushPromises();

      expectRevoked({ client_id: 'legacy-id', client_secret: 'legacy-secret', token: 'legacy-token' });
      expect(auth.accessToken).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('signs out without revoking when the instance rejects the token', async () => {
      storeSession(NOW - MINUTE);
      http.get.mockRejectedValue({ isAxiosError: true, response: { status: 401 } });
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('unauthorized');
      expect(http.post).not.toHaveBeenCalled();
      expect(storedSession()).toBeNull();
    });

    it('keeps the session when the instance cannot be reached', async () => {
      storeSession(NOW - MINUTE);
      http.get.mockRejectedValue({ isAxiosError: true, message: 'Network Error' });
      const auth = useAuthStore();
      await flushPromises();

      expect(auth.accessToken).toBe('token');
      expect(storedSession()).not.toBeNull();
    });
  });

  describe('session lifecycle', () => {
    it('persists a completed login with the current time as last activity', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      expect(auth.accessToken).toBe('token');
      expect(storedSession()).toEqual({ ...credentials, lastActivityAt: NOW });
    });

    it('writes activity at most every 30 seconds', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      auth.recordActivity(NOW + 10 * 1000);
      expect(storedSession()?.lastActivityAt).toBe(NOW);

      auth.recordActivity(NOW + 31 * 1000);
      expect(storedSession()?.lastActivityAt).toBe(NOW + 31 * 1000);
      expect(auth.lastActivityAt).toBe(NOW + 31 * 1000);
    });

    it('revokes the token and clears everything on logout', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.logout();

      expectRevoked();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('still logs out locally when revocation fails', async () => {
      http.post.mockRejectedValue(new Error('Network Error'));
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.logout();

      expect(auth.accessToken).toBeNull();
      expect(localStorage.length).toBe(0);
    });

    it('does not revoke on a 401: the token is already invalid', async () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      await auth.handleUnauthorized();

      expect(http.post).not.toHaveBeenCalled();
      expect(auth.accessToken).toBeNull();
      expect(auth.sessionEndReason).toBe('unauthorized');
    });
  });

  describe('other tabs', () => {
    it('logs this tab out when another tab removed the session', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', { key: 'mastodon_auth', newValue: null }));

      expect(auth.accessToken).toBeNull();
      expect(http.post).not.toHaveBeenCalled();
    });

    it('adopts the activity recorded by another tab', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', {
        key: 'mastodon_auth',
        newValue: JSON.stringify({ ...credentials, lastActivityAt: NOW + 5 * MINUTE }),
      }));

      expect(auth.lastActivityAt).toBe(NOW + 5 * MINUTE);
      expect(auth.accessToken).toBe('token');
    });

    it('ignores changes to other keys', () => {
      const auth = useAuthStore();
      auth.completeLogin(credentials);

      window.dispatchEvent(new StorageEvent('storage', { key: 'masto-publish-later-features', newValue: null }));

      expect(auth.accessToken).toBe('token');
    });
  });
});
```

Create `src/components/Auth/LoginForm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const api = vi.hoisted(() => ({ registerApplication: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import LoginForm from './LoginForm.vue';
import { takePendingLogin } from '../../utils/oauthFlow';
import { createCodeChallenge } from '../../utils/pkce';

describe('LoginForm', () => {
  let assign: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    api.registerApplication.mockResolvedValue({ client_id: 'client-id', client_secret: 'client-secret' });
    assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  afterEach(() => {
    assign.mockRestore();
  });

  it('accepts a bare domain and redirects to the instance with state and a PKCE challenge', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('#instance').setValue('mastodon.social');
    await wrapper.find('form').trigger('submit');
    // WebCrypto hashing resolves outside the microtask queue: wait for the redirect itself.
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));

    expect(api.registerApplication).toHaveBeenCalledWith('https://mastodon.social');
    const pending = takePendingLogin();
    expect(pending).toMatchObject({ instance: 'https://mastodon.social', clientId: 'client-id', clientSecret: 'client-secret' });

    const url = new URL(assign.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://mastodon.social/oauth/authorize');
    expect(url.searchParams.get('state')).toBe(pending?.state);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(await createCodeChallenge(pending!.codeVerifier));
  });

  it('refuses a plain http instance without contacting it', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('#instance').setValue('http://mastodon.social');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('The instance address must use https://');
    expect(api.registerApplication).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
```

Create `src/components/OAuthCallback.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({ getAccessToken: vi.fn(), verifyCredentials: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }));

vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('vue-router', () => ({ useRouter: () => router }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), isAxiosError: () => false } }));

import OAuthCallback from './OAuthCallback.vue';
import { savePendingLogin } from '../utils/oauthFlow';
import { useAuthStore } from '../stores/auth';

const pending = {
  instance: 'https://masto.example',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  state: 'state-123',
  codeVerifier: 'verifier-456',
};

function visitCallback(query: string): void {
  window.history.replaceState(null, '', `/oauth/callback${query}`);
}

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    setActivePinia(createPinia());
    api.getAccessToken.mockResolvedValue({ access_token: 'token' });
    api.verifyCredentials.mockResolvedValue({ id: '1', acct: 'me' });
  });

  it('exchanges the code with the PKCE verifier, saves the session and strips the code from the URL', async () => {
    savePendingLogin(pending);
    visitCallback('?code=abc&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).toHaveBeenCalledWith('https://masto.example', 'abc', 'client-id', 'client-secret', 'verifier-456');
    expect(useAuthStore().accessToken).toBe('token');
    expect(router.push).toHaveBeenCalledWith({ name: 'composer' });
    expect(window.location.search).toBe('');
    expect(sessionStorage.length).toBe(0);
  });

  it('rejects a callback whose state does not match, without exchanging the code', async () => {
    savePendingLogin(pending);
    visitCallback('?code=abc&state=forged');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('This sign-in link is invalid or has expired. Please sign in again.');
    expect(router.push).toHaveBeenCalledWith({ name: 'home' });
    expect(useAuthStore().accessToken).toBeNull();
  });

  it('rejects a callback when no login was started in this tab', async () => {
    visitCallback('?code=abc&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(api.getAccessToken).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('This sign-in link is invalid or has expired. Please sign in again.');
  });

  it('explains a cancelled authorization', async () => {
    savePendingLogin(pending);
    visitCallback('?error=access_denied&state=state-123');

    mount(OAuthCallback);
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith('You cancelled the authorization on your instance.');
    expect(router.push).toHaveBeenCalledWith({ name: 'home' });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/stores/auth.test.ts src/components/Auth/LoginForm.test.ts src/components/OAuthCallback.test.ts`
Expected: most tests FAIL:
- the current store reads the four legacy keys, has no `completeLogin`/`recordActivity`, never revokes, and calls `useRouter()`;
- the current LoginForm has no `state`/PKCE and calls `auth.setInstance`;
- the current callback never checks `state`.

- [ ] **Step 3: Rewrite the store:** replace the whole of `src/stores/auth.ts` with:

```ts
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
    if (session.lastActivityAt !== null && now - session.lastActivityAt < ACTIVITY_WRITE_INTERVAL_MS) return;

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
    try {
      const response = await axios.get(`${session.instance}/api/v1/accounts/verify_credentials`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        timeout: VERIFY_TIMEOUT_MS,
      });
      account.value = response.data;
    } catch (error) {
      // Only a rejected token ends the session; being offline at startup must not.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        await logout({ revoke: false, reason: 'unauthorized' });
      }
    }
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
    applySession(session);
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
    logout,
    handleUnauthorized,
    acknowledgeSessionEnd,
  };
});
```

Design notes:
- `logout` clears local state **before** the revoke request. The UI updates at once, the other tabs get the `storage` event at once, and a slow or failing instance can't keep the user signed in.
- The store never navigates. That removes the old `useRouter()`-inside-a-store fragility; `App.vue` reacts instead.

- [ ] **Step 4: OAuth calls in `src/composables/useMastodonApi.ts`**

Replace the line `import { normalizeUrl } from '../utils/url';` with:

```ts
import { getRedirectUri, OAUTH_SCOPES } from '../config/constants';
```

Replace everything from the `/**` that starts `* Registers a new application with the Mastodon instance.` (the function's own JSDoc, inside `useMastodonApi`) up to, but not including, the `/**` of `* Verifies the user's credentials with the Mastodon instance.` with:

```ts
  /**
   * Registers a new application with the Mastodon instance.
   * @param {string} instanceUrl - The origin of the Mastodon instance (already normalized).
   * @returns {Promise<{ client_id: string; client_secret: string }>} The app credentials.
   * @throws {Error} If the registration fails or the response is invalid.
   */
  async function registerApplication(instanceUrl: string): Promise<{ client_id: string; client_secret: string }> {
    try {
      const response = await api.post(`${instanceUrl}/api/v1/apps`, {
        client_name: 'Toot Scheduler',
        redirect_uris: getRedirectUri(),
        scopes: OAUTH_SCOPES,
        website: window.location.origin + import.meta.env.BASE_URL,
      });

      if (!response.data?.client_id || !response.data?.client_secret) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Exchanges the authorization code for an access token, proving PKCE possession with the verifier.
   * @param {string} instanceUrl - The instance origin the login started with.
   * @param {string} code - The authorization code.
   * @param {string} clientId - The client ID.
   * @param {string} clientSecret - The client secret.
   * @param {string} codeVerifier - The PKCE verifier matching the challenge sent to /oauth/authorize.
   * @returns {Promise<{ access_token: string }>} The access token data.
   * @throws {Error} If the request fails or no token is returned.
   */
  async function getAccessToken(
    instanceUrl: string,
    code: string,
    clientId: string,
    clientSecret: string,
    codeVerifier: string,
  ): Promise<{ access_token: string }> {
    try {
      const response = await api.post(`${instanceUrl}/oauth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: getRedirectUri(),
        code_verifier: codeVerifier,
        scope: OAUTH_SCOPES,
      });

      if (!response.data?.access_token) {
        throw new Error('Invalid response from server');
      }

      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }
```

In the object returned at the bottom of the file, replace the JSDoc lines:

```ts
     * Registers a new application with the Mastodon instance.
     * @param {string} instanceUrl - The URL of the Mastodon instance.
     * @returns {Promise<Object>} The application data containing client_id and client_secret.
```

with:

```ts
     * Registers a new application with the Mastodon instance.
     * @param {string} instanceUrl - The origin of the Mastodon instance.
     * @returns {Promise<{ client_id: string; client_secret: string }>} The app credentials.
```

and:

```ts
     * Gets an access token from the Mastodon instance using the authorization code.
     * @param {string} code - The authorization code.
     * @param {string} clientId - The client ID.
     * @param {string} clientSecret - The client secret.
     * @returns {Promise<Object>} The access token data.
```

with:

```ts
     * Exchanges the authorization code (and PKCE verifier) for an access token.
     * @param {string} instanceUrl - The instance origin.
     * @param {string} code - The authorization code.
     * @param {string} clientId - The client ID.
     * @param {string} clientSecret - The client secret.
     * @param {string} codeVerifier - The PKCE verifier.
     * @returns {Promise<{ access_token: string }>} The access token data.
```

(`registerApplication` no longer re-normalizes: `LoginForm` passes an already validated origin.)

- [ ] **Step 5: `LoginForm.vue`: replace the whole `<script setup>` block** (from `<script setup lang="ts">` to `</script>`, inclusive) with:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useMastodonApi } from '../../composables/useMastodonApi';
import { normalizeUrl } from '../../utils/url';
import { createPkcePair, createRandomToken } from '../../utils/pkce';
import { buildAuthorizeUrl, savePendingLogin } from '../../utils/oauthFlow';

const emit = defineEmits<{
  (e: 'close-child-modal'): void;
}>();

const instance = ref('');
const api = useMastodonApi();
const error = ref('');
const isLoading = ref(false);

async function handleLogin() {
  try {
    error.value = '';
    isLoading.value = true;

    const instanceUrl = normalizeUrl(instance.value);
    const appData = await api.registerApplication(instanceUrl);
    const state = createRandomToken();
    const { verifier, challenge } = await createPkcePair();

    // Kept for this tab only, until the instance redirects back to /oauth/callback.
    savePendingLogin({
      instance: instanceUrl,
      clientId: appData.client_id,
      clientSecret: appData.client_secret,
      state,
      codeVerifier: verifier,
    });

    emit('close-child-modal');
    window.location.assign(buildAuthorizeUrl(instanceUrl, appData.client_id, state, challenge));
  } catch (err) {
    console.error('Login error:', err);
    error.value = err instanceof Error ? err.message : 'Failed to connect to Mastodon instance. Please check the URL and try again.';
  } finally {
    isLoading.value = false;
  }
}
</script>
```

- [ ] **Step 6: `OAuthCallback.vue`: replace the whole `<script setup>` block** with:

```vue
<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../stores/auth';
import { useMastodonApi } from '../composables/useMastodonApi';
import { readAuthorizationCode, takePendingLogin } from '../utils/oauthFlow';

const router = useRouter();
const auth = useAuthStore();
const api = useMastodonApi();
const toast = useToast();

onMounted(async () => {
  const search = window.location.search;
  const pending = takePendingLogin();
  // The authorization code is single-use: remove it from the address bar and history.
  window.history.replaceState(window.history.state, '', window.location.pathname);

  try {
    if (!pending) {
      throw new Error('This sign-in link is invalid or has expired. Please sign in again.');
    }

    const code = readAuthorizationCode(search, pending.state);
    const tokenData = await api.getAccessToken(
      pending.instance,
      code,
      pending.clientId,
      pending.clientSecret,
      pending.codeVerifier,
    );

    auth.completeLogin({
      instance: pending.instance,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      accessToken: tokenData.access_token,
    });
    auth.setAccount(await api.verifyCredentials());

    router.push({ name: 'composer' });
  } catch (err) {
    console.error('OAuth callback error:', err);
    toast.error(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    router.push({ name: 'home' });
  }
});
</script>
```

- [ ] **Step 7: `App.vue`**

Replace `import { ref, computed } from 'vue';` with:

```ts
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
```

Replace:

```ts
async function handleLogout(): Promise<void> {
  await auth.logout();
  isMenuOpen.value = false;
  toast.success('You have been logged out successfully.');
}
```

with:

```ts
const route = useRoute();
const router = useRouter();

async function handleLogout(): Promise<void> {
  isMenuOpen.value = false;
  await auth.logout();
  toast.success('You have been logged out successfully.');
}

// Whatever ended the session (logout, inactivity, rejected token, another tab), leave protected pages.
watch(() => auth.accessToken, (token) => {
  if (!token && route.meta.requiresAuth) {
    router.push({ name: 'home' });
  }
});

watch(() => auth.sessionEndReason, (reason) => {
  if (reason === 'inactivity') {
    toast.info("You've been signed out after 30 minutes of inactivity.");
  } else if (reason === 'unauthorized') {
    toast.warning('Your session is no longer valid. Please sign in again.');
  }
  if (reason) auth.acknowledgeSessionEnd();
}, { immediate: true });
```

`immediate: true` matters: an expired session is detected while the store is created, before `App.vue`'s watchers exist.

(The old `useSessionTimeout` keeps compiling with the new store: it calls `auth.logout()`, which now revokes. Task 6 rewrites it.)

- [ ] **Step 8: Verify**

```bash
npx vitest run src/stores/auth.test.ts src/components/Auth/LoginForm.test.ts src/components/OAuthCallback.test.ts
npm run typecheck; echo "exit=$?"
npm test
npm run lint
```

Expected: `Tests  20 passed (20)`, `exit=0`, `Tests  124 passed (124)` and `0 errors`. Run the first command 3 times: it must stay green every time (the WebCrypto timing note in Context).

- [ ] **Step 9: Commit**

```bash
git add src/stores/auth.ts src/stores/auth.test.ts src/components/Auth/LoginForm.vue src/components/Auth/LoginForm.test.ts src/components/OAuthCallback.vue src/components/OAuthCallback.test.ts src/composables/useMastodonApi.ts src/App.vue
git commit -m "fix(auth): state+PKCE login, revoke on logout and on expired sessions, sync tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/stores/auth.ts", "src/stores/auth.test.ts", "src/components/Auth/LoginForm.vue", "src/components/Auth/LoginForm.test.ts", "src/components/OAuthCallback.vue", "src/components/OAuthCallback.test.ts", "src/composables/useMastodonApi.ts", "src/App.vue"], "verifyCommand": "npx vitest run src/stores/auth.test.ts src/components/Auth/LoginForm.test.ts src/components/OAuthCallback.test.ts", "acceptanceCriteria": ["store API reworked, no router inside", "expired/legacy sessions revoked before any other use", "401 at startup signs out without revoke; offline keeps session", "logout revokes, survives revoke failure", "activity throttled 30 s; tabs synced via storage event", "login sends state + S256; callback checks state, sends verifier, strips code", "App leaves protected pages and toasts the reason", "typecheck clean, 124 tests pass"], "requiresUserVerification": false}
```

---

### Task 6: Inactivity timers from the persisted last activity (SEC-04b, WEB-03)

**Goal:** The 30-minute expiry and the 5-minute warning are computed from `auth.lastActivityAt`, so activity in another tab counts. Activity events no longer reset timers on every mouse move. A background tab re-checks the deadline as soon as it becomes visible again.

**Files:**
- Rewrite: `src/composables/useSessionTimeout.ts`
- Test: `src/composables/useSessionTimeout.test.ts`

**Acceptance Criteria:**
- [ ] Warning at 25 min, sign-out at 30 min with revocation and `sessionEndReason: 'inactivity'`
- [ ] Activity postpones the end
- [ ] 100 activity events in 1 s cause no storage write; one write happens again after 30 s
- [ ] Activity recorded by another tab (`storage` event) postpones the end
- [ ] Clicking the warning extends the session and dismisses the warning
- [ ] A `visibilitychange` after the deadline signs out immediately
- [ ] Listens to `pointerdown`/`keydown`/`scroll` (passive) instead of `mousemove`/`keypress`/`click`. No `any` left, and no router use

**Verify:** `npx vitest run src/composables/useSessionTimeout.test.ts` → `Tests  6 passed (6)`

**Steps:**

- [ ] **Step 1: Write the failing test:** create `src/composables/useSessionTimeout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), isAxiosError: () => false }));
const toast = vi.hoisted(() => ({ warning: vi.fn(() => 'warning-id'), success: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));

vi.mock('axios', () => ({ default: http }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

import { useSessionTimeout } from './useSessionTimeout';
import { useAuthStore } from '../stores/auth';

const MINUTE = 60 * 1000;
const NOW = new Date('2030-01-01T12:00:00.000Z').getTime();
const credentials = { instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token' };

const Host = defineComponent({
  setup() {
    useSessionTimeout();
    return () => null;
  },
});

function signInAndMount() {
  const auth = useAuthStore();
  auth.completeLogin(credentials);
  mount(Host);
  return auth;
}

describe('useSessionTimeout', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    setActivePinia(createPinia());
    http.post.mockResolvedValue({ data: {} });
    toast.warning.mockReturnValue('warning-id');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns after 25 minutes and signs out, revoking the token, after 30', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(25 * MINUTE);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(auth.accessToken).toBe('token');

    await vi.advanceTimersByTimeAsync(5 * MINUTE);
    expect(auth.accessToken).toBeNull();
    expect(auth.sessionEndReason).toBe('inactivity');
    expect(http.post).toHaveBeenCalledWith('https://masto.example/oauth/revoke', expect.any(URLSearchParams), { timeout: 5000 });
  });

  it('postpones the end when the user is active', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    window.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    expect(auth.accessToken).toBe('token');

    await vi.advanceTimersByTimeAsync(11 * MINUTE);
    expect(auth.accessToken).toBeNull();
  });

  it('writes activity to storage at most once per 30 seconds', async () => {
    signInAndMount();
    const setItem = vi.spyOn(window.localStorage, 'setItem');

    for (let i = 0; i < 100; i++) {
      window.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(setItem).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30 * 1000);
    window.dispatchEvent(new Event('keydown'));
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it('counts activity recorded in another tab', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(20 * MINUTE);
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'mastodon_auth',
      newValue: JSON.stringify({ ...credentials, lastActivityAt: Date.now() }),
    }));
    await vi.advanceTimersByTimeAsync(20 * MINUTE);

    expect(auth.accessToken).toBe('token');
  });

  it('extends the session from the warning', async () => {
    const auth = signInAndMount();

    await vi.advanceTimersByTimeAsync(25 * MINUTE);
    const options = (toast.warning.mock.calls[0] as unknown[])[1] as { onClick: () => void };
    options.onClick();
    await flushPromises();
    expect(toast.dismiss).toHaveBeenCalledWith('warning-id');

    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(auth.accessToken).toBe('token');
  });

  it('signs out as soon as a throttled background tab becomes visible again after the deadline', async () => {
    const auth = signInAndMount();

    vi.setSystemTime(NOW + 40 * MINUTE);
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();

    expect(auth.accessToken).toBeNull();
    expect(auth.sessionEndReason).toBe('inactivity');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/composables/useSessionTimeout.test.ts`
Expected failures:
- the old composable needs a router;
- it never revokes and never sets the reason;
- it ignores `pointerdown` and `storage` events;
- its timers restart from mount time.

- [ ] **Step 3: Write the implementation:** replace the whole of `src/composables/useSessionTimeout.ts` with:

```ts
import { onMounted, onUnmounted, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useAuthStore } from '../stores/auth';
import { SESSION_DURATION_MS, SESSION_WARNING_MS } from '../config/constants';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

/**
 * Ends the session after SESSION_DURATION_MS without activity, with a warning
 * SESSION_WARNING_MS before. Timers are computed from the persisted last activity,
 * so activity in another tab counts too, and a closed tab is handled at the next start.
 */
export function useSessionTimeout() {
  const toast = useToast();
  const auth = useAuthStore();

  let warningTimer: number | undefined;
  let expiryTimer: number | undefined;
  let warningToastId: ReturnType<typeof toast.warning> | null = null;

  function clearTimers(): void {
    window.clearTimeout(warningTimer);
    window.clearTimeout(expiryTimer);
    if (warningToastId !== null) {
      toast.dismiss(warningToastId);
      warningToastId = null;
    }
  }

  async function expire(): Promise<void> {
    clearTimers();
    if (auth.accessToken) {
      await auth.logout({ reason: 'inactivity' });
    }
  }

  function extendSession(): void {
    auth.recordActivity();
    toast.success('Session extended for 30 minutes');
  }

  function showWarning(): void {
    warningToastId = toast.warning('Your session will expire in 5 minutes. Click here to stay signed in.', {
      timeout: SESSION_WARNING_MS,
      closeOnClick: false,
      onClick: extendSession,
    });
  }

  function schedule(): void {
    clearTimers();
    if (!auth.accessToken || auth.lastActivityAt === null) return;

    const remaining = auth.lastActivityAt + SESSION_DURATION_MS - Date.now();
    if (remaining <= 0) {
      void expire();
      return;
    }
    warningTimer = window.setTimeout(showWarning, Math.max(0, remaining - SESSION_WARNING_MS));
    expiryTimer = window.setTimeout(() => void expire(), remaining);
  }

  function handleActivity(): void {
    // The store only writes (and so only reschedules) every ACTIVITY_WRITE_INTERVAL_MS.
    auth.recordActivity();
  }

  function handleVisibilityChange(): void {
    // Background tabs throttle timers: re-check as soon as the tab is visible again.
    if (document.visibilityState === 'visible') schedule();
  }

  watch([() => auth.accessToken, () => auth.lastActivityAt], schedule);

  onMounted(() => {
    schedule();
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, handleActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    clearTimers();
    ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, handleActivity));
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    extendSession,
  };
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/composables/useSessionTimeout.test.ts` → `Tests  6 passed (6)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`
Run: `npm test` → `Tests  130 passed (130)`
Run: `npm run lint` → `0 errors` (6 warnings: the `any` in this file is gone)

- [ ] **Step 5: Commit**

```bash
git add src/composables/useSessionTimeout.ts src/composables/useSessionTimeout.test.ts
git commit -m "fix(auth): expire sessions from the persisted last activity, across tabs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/composables/useSessionTimeout.ts", "src/composables/useSessionTimeout.test.ts"], "verifyCommand": "npx vitest run src/composables/useSessionTimeout.test.ts", "acceptanceCriteria": ["warning 25 min, sign-out 30 min with revoke", "activity postpones", "activity writes throttled to 30 s", "other-tab activity counts", "warning click extends", "visibilitychange re-checks deadline"], "requiresUserVerification": false}
```

---

### Task 7: HTTP client: exact-origin token, 401 → sign-out, axios upload, error `cause` (SEC-06, SEC-08, CC-05)

**Goal:**
- The token is attached only on an exact instance-origin match (no more prefix check).
- A 401 from the instance ends the session cleanly.
- Media uploads go through the same client (no hand-rolled XHR holding the token).
- Rethrown API errors keep the original as `cause`.

**Files:**
- Rewrite: `src/utils/api.ts`
- Test: `src/utils/api.test.ts`
- Modify: `src/composables/useMastodonApi.ts` (`uploadMedia`, a constant, every `throw new Error(handleApiError(…))`)
- Modify: `src/composables/useMastodonApi.test.ts` (new `describe('uploadMedia')`)
- Rewrite: `src/utils/error.ts`
- Modify: `tsconfig.app.json` (`lib`)

**Acceptance Criteria:**
- [ ] No `Authorization` header for `https://masto.example.evil.com`, `https://evil.example` or `https://masto.example@evil.example`; the header is present for the instance
- [ ] A 401 from the instance calls `auth.handleUnauthorized()` once. A 401 from another origin, or a 500, does not
- [ ] `uploadMedia`:
  - posts `FormData` to `/api/v2/media` with `Content-Type: multipart/form-data` and a 120 s timeout;
  - converts `onUploadProgress` into a percentage;
  - keeps no `XMLHttpRequest` and no manual `Authorization`
- [ ] Every rethrown error has `cause` set to the original. `handleApiError` takes `unknown`
- [ ] `npm test` → 136 passed, `npm run lint` → 0 errors and 5 warnings

**Verify:** `npx vitest run src/utils/api.test.ts src/composables/useMastodonApi.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/utils/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

const auth = vi.hoisted(() => ({
  accessToken: 'token' as string | null,
  instance: 'https://masto.example' as string | null,
  handleUnauthorized: vi.fn(),
}));

vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }));

import { createApiClient } from './api';

function clientRespondingWith(status: number) {
  const seen: InternalAxiosRequestConfig[] = [];
  const api = createApiClient();
  const adapter: AxiosAdapter = async (config) => {
    seen.push(config);
    const response = { data: {}, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response,
      });
    }
    return response;
  };
  api.defaults.adapter = adapter;
  return { api, seen };
}

describe('createApiClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.accessToken = 'token';
    auth.instance = 'https://masto.example';
  });

  it('attaches the token to instance requests', async () => {
    const { api, seen } = clientRespondingWith(200);

    await api.get('https://masto.example/api/v1/accounts/verify_credentials');

    expect(seen[0].headers.Authorization).toBe('Bearer token');
  });

  it('never attaches the token to another origin, including a lookalike', async () => {
    const { api, seen } = clientRespondingWith(200);

    await api.get('https://masto.example.evil.com/steal');
    await api.get('https://evil.example/steal');
    await api.get('https://masto.example@evil.example/steal');

    seen.forEach(config => expect(config.headers.Authorization).toBeUndefined());
  });

  it('ends the session when the instance answers 401', async () => {
    const { api } = clientRespondingWith(401);

    await expect(api.get('https://masto.example/api/v1/scheduled_statuses')).rejects.toThrow('401');

    expect(auth.handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('ignores a 401 from another origin and other errors', async () => {
    await expect(clientRespondingWith(401).api.get('https://other.example/x')).rejects.toThrow();
    await expect(clientRespondingWith(500).api.get('https://masto.example/api/v1/x')).rejects.toThrow();

    expect(auth.handleUnauthorized).not.toHaveBeenCalled();
  });
});
```

In `src/composables/useMastodonApi.test.ts`, insert this block right before `  describe('rescheduleToot', () => {`:

```ts
  describe('uploadMedia', () => {
    it('posts the file as multipart through the API client and reports progress', async () => {
      http.post.mockResolvedValue({ data: { id: 'm1' } });
      const onProgress = vi.fn();
      const file = new File(['x'], 'cat.png', { type: 'image/png' });

      const media = await useMastodonApi().uploadMedia(file, onProgress);

      const [url, body, config] = http.post.mock.calls[0];
      expect(url).toBe('https://masto.example/api/v2/media');
      expect((body as FormData).get('file')).toBeInstanceOf(File);
      expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
      config.onUploadProgress({ loaded: 50, total: 200 });
      expect(onProgress).toHaveBeenCalledWith(25);
      expect(media).toEqual({ id: 'm1' });
    });

    it('keeps the original error as the cause', async () => {
      const original = { isAxiosError: true, message: 'Request failed', response: { status: 422, data: { error: 'File type not supported' } } };
      http.post.mockRejectedValue(original);

      const error = await useMastodonApi().uploadMedia(new File(['x'], 'a.pdf')).catch((e: Error) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('File type not supported');
      expect((error as Error).cause).toBe(original);
    });
  });

```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/api.test.ts src/composables/useMastodonApi.test.ts`
Expected failures:
- the lookalike origins receive the token (prefix check);
- there is no 401 handling;
- `uploadMedia` uses XHR, so `http.post` is never called;
- errors have no `cause`.

- [ ] **Step 3: Rewrite `src/utils/api.ts`** with:

```ts
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

/**
 * Tells whether a request URL is on the instance origin. A prefix check would also
 * match https://masto.example.evil.com, which must never receive the token.
 * @param {string | undefined} url - The request URL.
 * @param {string} instance - The instance origin.
 * @returns {boolean} True when the URL's origin is exactly the instance.
 */
function isInstanceUrl(url: string | undefined, instance: string): boolean {
  if (!url) return false;
  try {
    return new URL(url).origin === instance;
  } catch {
    return false;
  }
}

/**
 * Creates the HTTP client for the Mastodon instance: it attaches the token to instance
 * requests only, and ends the session when the instance rejects the token (401).
 * @returns {import('axios').AxiosInstance} The configured client.
 */
export function createApiClient() {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  api.interceptors.request.use(function(config) {
    const auth = useAuthStore();
    if (auth.accessToken && auth.instance && isInstanceUrl(config.url, auth.instance)) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`;
    }
    return config;
  });

  api.interceptors.response.use(undefined, async function(error) {
    const auth = useAuthStore();
    if (
      axios.isAxiosError(error)
      && error.response?.status === 401
      && auth.instance
      && isInstanceUrl(error.config?.url, auth.instance)
    ) {
      await auth.handleUnauthorized();
    }
    return Promise.reject(error);
  });

  return api;
}
```

- [ ] **Step 4: `src/utils/error.ts`:** replace the whole file with:

```ts
import axios from 'axios';

/**
 * Turns an API or runtime error into a message for the user.
 * @param {unknown} error - What was thrown.
 * @returns {string} The instance's error message when there is one, otherwise a generic one.
 */
export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.message || 'API request failed';
  }
  return error instanceof Error && error.message ? error.message : 'An unknown error occurred';
}
```

- [ ] **Step 5: `tsconfig.app.json`:** right after the `"tsBuildInfoFile": …,` line, add:

```json
    /* ES2022 for Error `cause`; supported by every browser this app targets */
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
```

- [ ] **Step 6: `src/composables/useMastodonApi.ts`**

1. Right after `const MAX_SCHEDULED_PAGES = 10;`, add:

```ts
/** Large images on slow connections need far more than the default 10 s. */
const MEDIA_UPLOAD_TIMEOUT_MS = 120000;
```

2. Replace the `uploadMedia` function, from `  async function uploadMedia(` up to, but not including, the `/**` of `* Updates the metadata for a media attachment.`. Keep its JSDoc. Use:

```ts
  async function uploadMedia(file: File, onProgress?: (progress: number) => void): Promise<MastodonMediaAttachment> {
    if (!auth.instance) throw new Error('No instance URL set');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post<MastodonMediaAttachment>(`${auth.instance}/api/v2/media`, formData, {
        // Not JSON: the browser sets the multipart boundary itself.
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: MEDIA_UPLOAD_TIMEOUT_MS,
        onUploadProgress: (event) => {
          if (onProgress && event.total) onProgress((event.loaded / event.total) * 100);
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }
```

3. Keep the original error everywhere it is rethrown:

```bash
sed -i '' 's/throw new Error(handleApiError(error));/throw new Error(handleApiError(error), { cause: error });/; s/throw new Error(handleApiError(err));/throw new Error(handleApiError(err), { cause: err });/' src/composables/useMastodonApi.ts
grep -c "cause:" src/composables/useMastodonApi.ts
```

Expected: no `throw new Error(handleApiError(` line without `cause` remains (`grep -n "handleApiError(error))\|handleApiError(err))" src/composables/useMastodonApi.ts` → nothing). On Linux, use `sed -i` without `''`.

- [ ] **Step 7: Verify**

```bash
npx vitest run src/utils/api.test.ts src/composables/useMastodonApi.test.ts
npm run typecheck; echo "exit=$?"
npm test
npm run lint
grep -n "XMLHttpRequest" src/composables/useMastodonApi.ts
```

Expected: all pass, `exit=0`, `Tests  136 passed (136)`, `0 errors, 5 warnings`, no `XMLHttpRequest`.

- [ ] **Step 8: Commit**

```bash
git add src/utils/api.ts src/utils/api.test.ts src/utils/error.ts tsconfig.app.json src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts
git commit -m "fix(api): exact-origin token, sign out on 401, axios uploads, keep error causes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/api.ts", "src/utils/api.test.ts", "src/utils/error.ts", "tsconfig.app.json", "src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts"], "verifyCommand": "npx vitest run src/utils/api.test.ts src/composables/useMastodonApi.test.ts", "acceptanceCriteria": ["token only on exact instance origin", "401 from instance → handleUnauthorized", "uploadMedia via axios multipart, progress, 120 s", "errors keep cause; handleApiError(unknown)", "136 tests, lint 0 errors / 5 warnings"], "requiresUserVerification": false}
```

---

### Task 8: No console output in production, Security section in the README (SEC-09, SEC-03 documentation)

**Goal:** The production bundle contains no `console.*` call (API responses and account data used to be logged), and the README documents the security model and its trade-off.

**Files:**
- Rewrite: `vite.config.ts`
- Modify: `README.md` (new `## Security` section before `## Project Structure`)

**Acceptance Criteria:**
- [ ] `npm run build`, then `grep -o 'console\.[a-z]*' dist/assets/*.js` → no output (it was 23 calls before)
- [ ] `npm run dev` and `npm test` still show console output (the drop applies to production only)
- [ ] The README has a `## Security` section covering:
  - sign-in (state, PKCE, HTTPS, scopes);
  - token storage;
  - the 30-minute expiry with revocation and the multi-tab logout;
  - the trade-off of having no backend

**Verify:** `npm run build && ! grep -q 'console\.' dist/assets/*.js && echo "no console"` → `no console`

**Steps:**

- [ ] **Step 1: Measure the baseline**

Run: `npm run build && grep -o 'console\.[a-z]*' dist/assets/*.js | sort | uniq -c`
Expected: several `console.error`, `console.log` and `console.warn` calls (about 23).

- [ ] **Step 2: Replace the whole of `vite.config.ts`** with:

```ts
/// <reference types="node" />
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: '/toots-scheduler/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    // Never ship console output (API responses, account data) to production users.
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
}))
```

- [ ] **Step 3: Add the Security section:** insert this right before the `## Project Structure` line of `README.md`:

```markdown
## Security

Toot Scheduler is a static site with no backend. Here is what it does to protect your account:

- **Sign-in:** OAuth 2.0 with a random `state`, which blocks forged sign-in links, and PKCE (S256) on instances running Mastodon 4.3 or later. Only HTTPS instances are accepted, and the app requests only the scopes it needs (`read:accounts read:statuses write:media write:statuses`).
- **Where the token lives:** in your browser's `localStorage`, under a single `mastodon_auth` key. No server stores your token or your toots: everything stays on your instance.
- **Session end:** after 30 minutes without activity you are signed out, even if you closed the tab, and the token is revoked on your instance (`POST /oauth/revoke`). Logging out revokes it too. Signing out in one tab signs out every tab.
- **Known trade-off:** a script running on this page could read the token while you are signed in. That is the price of having no backend. The app never renders HTML coming from the API (`v-html` is forbidden by the linter), and no console output ships to production. Revoke the app at any time from your instance under *Preferences → Account → Authorized apps*.
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck; echo "exit=$?"
npm run build && ! grep -q 'console\.' dist/assets/*.js && echo "no console"
npm test
```

Expected: `exit=0`, `no console`, `Tests  136 passed (136)`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts README.md
git commit -m "chore(build): drop console output in production; document the security model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["vite.config.ts", "README.md"], "verifyCommand": "npm run build && ! grep -q 'console\\.' dist/assets/*.js && echo \"no console\"", "acceptanceCriteria": ["no console.* in the production bundle", "dev and test keep console output", "README Security section"], "requiresUserVerification": false}
```

---

### Task 9: Release 0.14.0

**Goal:** Version 0.14.0 (a MINOR bump: sign-in accepts a bare domain, sessions really expire, logout everywhere), with user-facing "What's New" entries.

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/stores/features.ts`

**Acceptance Criteria:**
- [ ] `package.json` version is `0.14.0`, matching the first `FeatureGroup.version`
- [ ] The 3 new feature ids are unique
- [ ] lint (0 errors), typecheck, test and build pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.14.0`

**Steps:**

- [ ] **Step 1: Read `.claude/skills/changelog/SKILL.md` and follow it.** This is a MINOR bump, because of new user-visible behaviour.

- [ ] **Step 2:** Run `npm version minor --no-git-tag-version` → `v0.14.0`.

- [ ] **Step 3:** Run `grep -nE "safer-sign-in|real-session-expiry|logout-everywhere" src/stores/features.ts` → no output.

- [ ] **Step 4:** Prepend this group at the top of the `features` array in `src/stores/features.ts`, before `version: '0.13.2'`:

```ts
    {
      version: '0.14.0',
      date: '2026-10-02',
      features: [
        {
          id: 'safer-sign-in',
          title: '🔐 Safer Sign-In',
          description: 'Signing in now uses extra protections against forged sign-in links, and only secure (https) instances are accepted. You can simply type your instance name, like mastodon.social.'
        },
        {
          id: 'real-session-expiry',
          title: '⏳ Sessions Really Expire',
          description: 'After 30 minutes without activity you are signed out, even if you closed the tab, and your access is revoked on your instance.'
        },
        {
          id: 'logout-everywhere',
          title: '🚪 Log Out Everywhere at Once',
          description: 'Logging out revokes the app\'s access on your instance and signs you out in every open tab.'
        },
      ],
    },
```

Note: existing users are signed out once after this update, because older saved sessions have no activity time. The toast explains it.

- [ ] **Step 5:** Run `npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts
git commit -m "chore(release): 0.14.0 — sign-in and session hardening

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.14.0 in package.json and features store", "3 unique ids", "lint, typecheck, test, build pass"], "requiresUserVerification": false}
```

---

### Task 10: User verification on a real Mastodon instance

**Goal:** The user confirms, on a real instance, the behaviours that mocked tests cannot prove: the PKCE/state flow, revocation, expiry across a closed tab, and multi-tab logout.

**Files:** none (manual check)

**Acceptance Criteria:**
- [ ] The user ran the checklist and confirmed it passes

**Verify:** the user's answer to the AskUserQuestion below

**Steps:**

- [ ] **Step 1: Hand the checklist to the user.** Run `npm run dev`, then open DevTools → Network and Application → Local Storage / Session Storage.
  1. **Bare domain + PKCE:** on the login form type `mastodon.social` (or your instance) without `https://`. Expected:
     - the authorize page URL contains `state=…`, `code_challenge=…` and `code_challenge_method=S256`;
     - after approving, the app lands on the composer;
     - the address bar no longer shows `?code=`;
     - Session Storage no longer has `mastodon_oauth_pending`;
     - Local Storage has a single `mastodon_auth` entry.
  2. **http refused:** type `http://mastodon.social`. Expected: "The instance address must use https://", and no request is sent.
  3. **Forged callback:** while signed out, open `http://localhost:5173/toots-scheduler/oauth/callback?code=fake&state=fake`. Expected: "This sign-in link is invalid or has expired…", no `/oauth/token` request, back on the landing page.
  4. **Cancel at the instance:** start a login, then click "Deny" on the instance. Expected: "You cancelled the authorization on your instance."
  5. **Logout revokes:** sign in, then click Logout. Expected:
     - a `POST /oauth/revoke` answering 200;
     - on the instance, *Preferences → Account → Authorized apps* no longer lists "Toot Scheduler" for this session.
  6. **Expiry after a closed tab:** sign in, close the tab. In DevTools (or a new tab before the app loads), edit `mastodon_auth.lastActivityAt` to 31 minutes ago (`Date.now() - 31*60*1000`), then open the app. Expected:
     - the toast "You've been signed out after 30 minutes of inactivity.";
     - a `POST /oauth/revoke` and no `verify_credentials`;
     - the landing page.
  7. **Multi-tab:** sign in, open the app in a second tab, click Logout in tab 1. Expected: tab 2 goes back to the landing page by itself.
  8. **Revoked elsewhere:** sign in, then revoke the app from the instance's *Authorized apps* page. Back in the app, reload the scheduled list (or schedule a toot). Expected: the toast "Your session is no longer valid. Please sign in again." and the landing page.
  9. **Media upload still works:** upload an image in the composer. Expected: the progress bar moves, and the image appears with its preview. This was rewritten from XHR to axios.
  10. **Production build:** run `npm run build && npm run preview`, sign in and use the app. Expected: no app output in the console.
  11. **Back after sign-in:** sign in, then press the browser Back button. Expected: you stay signed in, no `POST /oauth/revoke`, no error toast. Also, while signed in, open `…/toots-scheduler/oauth/callback?code=fake&state=fake`. Expected: still signed in.
  12. **Expiry with the tab open:** with two tabs open, run this in tab 2's console: `const s=JSON.parse(localStorage.mastodon_auth); s.lastActivityAt=Date.now()-26*60*1000; localStorage.mastodon_auth=JSON.stringify(s)`. Expected in tab 1: the "about to expire" warning. Clicking it shows "Session extended". Repeat with `-31*60*1000` and wait for the warning's timer, or switch tabs. Expected: the inactivity toast, `POST /oauth/revoke`, then the landing page in both tabs.
  13. **Upgrade from 0.13.x:** check out `fix/lot-1-data-integrity` (0.13.2), sign in, switch to this branch and reload. Expected: the inactivity toast, `POST /oauth/revoke` answering 200, the four legacy `mastodon_*` keys gone, and the app removed from *Authorized apps*.
  14. **Offline startup:** set DevTools to Offline and reload while signed in. Expected: still signed in, no sign-out, `mastodon_auth` kept.
  15. **Upload details:** the media request's Content-Type is `multipart/form-data; boundary=…`. An unsupported or oversized file shows the instance's error message.
  16. **Switching account in the same tab:** log out, then sign in with another account. Expected: no toot from the previous account appears at any point.

**User Verification Required:**
Before marking this task complete, you MUST call AskUserQuestion:
```yaml
AskUserQuestion:
  question: "On your Mastodon instance, do the Lot 2 checks pass (1–16: PKCE login, http refused, forged callback, cancel, logout revokes, closed-tab expiry, multi-tab, revoked elsewhere, upload, prod console, Back after sign-in, open-tab expiry, upgrade, offline startup, upload details, account switch)?"
  header: "Verification"
  options:
    - label: "All checks pass"
      description: "Sign-in and session behave as expected: Lot 2 can be closed"
    - label: "A check fails"
      description: "Tell me which number and what you saw; the task goes back to fixing, then re-verification"
```

```json:metadata
{"files": [], "verifyCommand": "", "acceptanceCriteria": ["user confirms the 16 checks on a real instance"], "requiresUserVerification": true, "userVerificationPrompt": "On your Mastodon instance, do the Lot 2 checks pass (1–16: PKCE login, http refused, forged callback, cancel, logout revokes, closed-tab expiry, multi-tab, revoked elsewhere, upload, prod console, Back after sign-in, open-tab expiry, upgrade, offline startup, upload details, account switch)?"}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. Push `fix/lot-2-auth-hardening` and open a PR with base `fix/lot-1-data-integrity` (stacked on #39).

## Self-review notes

- **Spec coverage (Lot 2):**
  - `normalizeUrl` HTTPS + bare domain → Task 1.
  - PKCE pair → Task 2. state + verifier in sessionStorage, checked before the exchange and removed afterwards, `?error=` handled, `replaceState` → Tasks 3 and 5.
  - Single client, 401 interceptor and `uploadMedia` on axios → Task 7. SEC-08 is closed by the exact-origin check in Task 7.
  - Single `mastodon_auth` key with silent legacy migration (legacy = expired, so revoked) → Tasks 4 and 5.
  - `logout()` best-effort revoke (5 s timeout) → Task 5. No `useRouter` in the store → Task 5.
  - Logger and `esbuild.drop` → Task 8 (drop only, see deviations).
  - Option A, persisted `lastActivityAt` written at most every 30 s, startup revoke before use, timers from `lastActivityAt`, multi-tab `storage` sync, constants file → Tasks 4, 5 and 6.
  - README Security → Task 8. Error `cause` (deferred item) → Task 7. WEB-03 → Task 6.
  - The spec's tests are covered: `isSessionExpired` boundaries, the expired startup (revoke, no verify), the throttle, multi-tab logout, legacy treated as expired, normalizeUrl cases, the RFC 7636 vector, state/denial, revoke on logout, 401.
- **Deviations from the spec (justified):**
  - No `createApiClient(instance)` with `baseURL` and relative paths: the exact-origin check gives the same protection without rewriting every call.
  - No separate dev `logger` utility: `esbuild.drop` already removes every console call from production, and dev keeps them.
  - Activity throttling is done in the store with a timestamp instead of `useThrottleFn`, which is easier to test with fake timers.
  - The pending login (client id/secret) lives in `sessionStorage` until the callback, instead of being written to `localStorage` before the redirect. An abandoned login leaves nothing behind.
- **Known residuals:**
  - While signed in, a script injected into the page could read the token. That is the D1 trade-off; the CSP comes in Lot 3.
  - On instances older than 4.3, PKCE is ignored and `state` alone protects the flow.
  - Existing users are signed out once after the update.
- **Hardening added during task and final reviews:**
  - `normalizeUrl` also rejects hosts without a dot (except local hosts). A stored session whose instance is not an HTTPS origin, or malformed data, is erased without being revoked, so its token is never sent over http.
  - An activity time more than 5 minutes in the future counts as expired; smaller clock skew is tolerated. The spec said a future value means "not expired".
  - `recordActivity` checks expiry first, then throttles, then re-reads `mastodon_auth` before writing. It never brings back a session another tab removed, and it adopts a switched account and reloads it. `loadAccount` ignores results for a token that is no longer current.
  - Expiry (from the timer or from late activity) goes through `expireIfIdle`. That function re-reads storage, so another tab's recent activity keeps the session alive.
  - A 401 is ignored when the request carried an older token than the current one.
  - The OAuth callback never touches an existing session (Back button, stray link). It uses `router.replace`, and it only undoes the session it created itself, without blocking on the revoke. The no-pending message mentions another tab.
  - `scroll` is captured and `wheel` counts as activity. The warning says "about to expire" instead of promising 5 minutes.
  - The scheduled-toots store is reset whenever the session changes, and a list loaded under an old token is discarded.
  - Upload errors show the instance's message. The landing-page FAQ no longer claims "totally secure". The README Security section states precisely when sessions end and what is stored.
  - The spec's `src/utils/session.ts` is `src/utils/authSession.ts`. The separate `oauth_state` / `oauth_verifier` keys became a single `mastodon_oauth_pending` object.
- **CC-05 is partial:** `useMastodonApi()` still creates one axios client per call. The auth store calls axios directly for `verify_credentials` and `/oauth/revoke`, to avoid a store → API → store import cycle. `verifyCredentials` and `updateMediaMetadata` still rethrow without `cause`.
- **More accepted residuals:**
  - Revocation is best effort: if the user is offline or the instance is down, the token stays valid until the user revokes it under *Authorized apps*. The README says so.
  - If another tab switches account while a new toot is being typed, the typed text stays in the composer, now under the new account.
  - Response validation (SEC-07, zod) and the CSP (SEC-03 part 1, WEB-04) are in Lot 3.
