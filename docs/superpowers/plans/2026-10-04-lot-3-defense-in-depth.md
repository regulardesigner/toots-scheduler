# Lot 3 — CSP & Defense in Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limit what a future XSS could do and stop trusting the instance blindly: a strict CSP in production, validated API responses, uploads checked before sending, and a confirmed, honest "Say Thanks".

**Architecture:**
- **CSP:** a small Vite plugin injects a CSP `<meta>` into the production `index.html` only. The dev server needs inline scripts and websockets. The inline redirect script moves to `public/spa-redirect.js`, so the policy needs no `'unsafe-inline'` for scripts.
- **Response validation:** zod schemas in `src/schemas/mastodon.ts` validate every response the app relies on, at the API boundary (`useMastodonApi`, auth store). Image URLs must be https. Nulls are normalized so the rest of the code is unchanged.
- **Uploads:** checked by a pure `getImageRejection(file)` before sending, drag and drop included.
- **Say Thanks:** goes through a confirmation modal showing the exact message, and failures are reported.

**Tech Stack:** Vue 3.5, TypeScript 5.7, zod 3.24 (already a dependency), Vite 6 plugin API, Vitest 4 + happy-dom, Playwright (scratchpad, for the controller's end-to-end run).

**User Verification:** YES. The user asked: "test everything you can yourself, tell me what you can't, publish the PR". Task 7 is the gate: the controller runs the Playwright end-to-end suite on the production build (CSP violations included), reports the result and the checks that need a real instance, and asks the user before closing.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 3:
- SEC-03 (CSP);
- WEB-04 (inline script);
- SEC-07 (response validation);
- SEC-11 (upload type check);
- SEC-12 and BUG-11 (Say Thanks), with decision **D4 = confirmation modal**;
- BUG-10 (upload progress key and multi-file).

---

## Context the engineer needs

- **Branch:** `fix/lot-3-defense-in-depth`, stacked on `fix/lot-2-auth-hardening` (PR #40, itself on #39 and #38). Open the PR against `fix/lot-2-auth-hardening`.
- **Quality commands:** `npm run lint` (0 errors), `npm run typecheck` (`vue-tsc -b`), `npm test`, `npm run build`. Tests live next to their sources (`*.test.ts`) and import from `'vitest'` explicitly.
- **Skills:** read `.claude/skills/vue3-codegen/SKILL.md`, `.claude/skills/ui-design-system/SKILL.md` (new modal), `.claude/skills/web-security/SKILL.md` (§1, §4, §5, §8) and `.claude/skills/mastodon-api/SKILL.md`. Read `.claude/skills/changelog/SKILL.md` for Task 6.
- **Mastodon facts:**
  - MediaAttachment: `preview_url` and `description` can be `null`, and `type` can be `unknown`.
  - ScheduledStatus `params.*` fields are nullable, and some clients store booleans as strings. `isOnlyScheduleChange` already handles both, so the scheduled-status schema keeps `params` as sent and only checks what the app relies on.
- **GitHub Pages can't send HTTP headers:**
  - The CSP is a `<meta>` tag, which ignores `frame-ancestors`, so clickjacking protection is not possible here.
  - `public/404.html` keeps its own inline scripts. GitHub Pages serves that file for unknown paths; it has no CSP and only redirects.
- **Vite build warning:** `<script src="/toots-scheduler/spa-redirect.js"> in "/index.html" can't be bundled without type="module"` is expected. The file is copied as-is from `public/` and must run before the app module.
- **Dry run:** every code block below was dry-run on a scratch copy of this branch:
  - 183 unit tests pass, typecheck is clean, and lint reports 0 errors and 4 warnings;
  - the production build has the CSP and no inline script;
  - a 24-check Playwright run (Lot 2 regression plus Lot 3) passes with **no CSP violation**.

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/schemas/mastodon.ts` (+ test) | Create | zod schemas + `parseApiResponse` |
| `src/types/mastodon.ts` | Modify | `MastodonMediaAttachment.type` adds `'unknown'` |
| `src/composables/useMastodonApi.ts` (+ test) | Modify | Validate responses (T2); `sendThanks(message)` (T5) |
| `src/stores/auth.ts` (+ test) | Modify | Validate the account on restore |
| `src/components/Toot/ScheduledToots.vue` | Modify | Show a list error even when the list is empty |
| `src/utils/media.ts` (+ test) | Create | Supported image types, size and count limits, `getImageRejection` |
| `src/components/MediaUpload.vue` (+ test) | Modify | Check before upload (drop included); unique progress keys; keep all files |
| `src/config/constants.ts` | Modify | `THANKS_RECIPIENT` |
| `src/utils/thanks.ts` (+ test) | Create | `buildThanksMessage` |
| `src/components/Modals/ThanksConfirmModal.vue` (+ test) | Create | Confirmation dialog showing the exact message |
| `src/App.vue` | Modify | Open, cancel and confirm Thanks; report failures |
| `public/spa-redirect.js`, `index.html`, `vite.config.ts`, `README.md` | Create/Modify | External redirect script, CSP plugin, docs |
| `package.json`, `package-lock.json`, `src/stores/features.ts` | Modify | Release 0.15.0 |

Task order: each task leaves typecheck and tests green.

---

### Task 1: zod schemas for instance responses (SEC-07)

**Goal:** Pure, tested schemas describe what the app accepts from the instance: accounts, media attachments, scheduled statuses, app registration and token responses. Image URLs must be https.

**Files:**
- Create: `src/schemas/mastodon.ts`
- Test: `src/schemas/mastodon.test.ts`
- Modify: `src/types/mastodon.ts` (one line)

**Acceptance Criteria:**
- [ ] An account with a `javascript:`, `data:` or plain `http:` avatar is refused. In dev, http is accepted only for localhost
- [ ] A media attachment: a null `preview_url` falls back to `url`, a null `description` becomes `undefined`, and an unknown `type` is refused
- [ ] A scheduled status with null params is accepted and its params are kept as sent; null `text` becomes `''`
- [ ] App registration requires `client_id` and `client_secret`, and the token response requires a non-empty `access_token`
- [ ] `parseApiResponse` throws `Your instance sent an unexpected response. Please try again later.` on a mismatch

**Verify:** `npx vitest run src/schemas/mastodon.test.ts` → `Tests  8 passed (8)`

**Steps:**

- [ ] **Step 1: Write the failing test:** create `src/schemas/mastodon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  AccountSchema,
  AppRegistrationSchema,
  MediaAttachmentSchema,
  ScheduledStatusSchema,
  TokenResponseSchema,
  parseApiResponse,
} from './mastodon';

const account = { id: '1', username: 'alice', acct: 'alice', display_name: 'Alice', avatar: 'https://masto.example/a.png', bot: false };
const media = { id: 'm1', type: 'image', url: 'https://masto.example/m1.png', preview_url: 'https://masto.example/m1-small.png', description: null };
const scheduled = {
  id: 's1',
  scheduled_at: '2031-01-01T12:00:00.000Z',
  params: { text: 'Hello', visibility: null, language: null, sensitive: null, spoiler_text: null, media_ids: null, poll: null },
  media_attachments: [],
};

describe('mastodon schemas', () => {
  it('accepts an account and drops fields the app does not use', () => {
    expect(AccountSchema.parse(account)).toEqual({ id: '1', username: 'alice', acct: 'alice', display_name: 'Alice', avatar: 'https://masto.example/a.png' });
  });

  it('refuses an avatar that is not an https URL', () => {
    expect(AccountSchema.safeParse({ ...account, avatar: 'javascript:alert(1)' }).success).toBe(false);
    expect(AccountSchema.safeParse({ ...account, avatar: 'http://evil.example/a.png' }).success).toBe(false);
    expect(AccountSchema.safeParse({ ...account, avatar: 'data:image/png;base64,AAAA' }).success).toBe(false);
  });

  it('normalizes a media attachment', () => {
    expect(MediaAttachmentSchema.parse(media)).toEqual({ ...media, description: undefined });
    expect(MediaAttachmentSchema.parse({ ...media, preview_url: null }).preview_url).toBe('https://masto.example/m1.png');
  });

  it('refuses a media attachment with an unsafe URL or an unknown type', () => {
    expect(MediaAttachmentSchema.safeParse({ ...media, preview_url: 'javascript:alert(1)' }).success).toBe(false);
    expect(MediaAttachmentSchema.safeParse({ ...media, type: 'hologram' }).success).toBe(false);
  });

  it('accepts a scheduled status whose params are null, and keeps them as sent', () => {
    const parsed = ScheduledStatusSchema.parse(scheduled);
    expect(parsed.params.visibility).toBeNull();
    expect(parsed.params.text).toBe('Hello');
    expect(ScheduledStatusSchema.parse({ ...scheduled, params: { ...scheduled.params, text: null } }).params.text).toBe('');
  });

  it('refuses a scheduled status without a usable shape', () => {
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, media_attachments: 'none' }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, params: undefined }).success).toBe(false);
    expect(ScheduledStatusSchema.safeParse({ ...scheduled, id: 42 }).success).toBe(false);
  });

  it('requires credentials in app registration and token responses', () => {
    expect(AppRegistrationSchema.safeParse({ client_id: 'id' }).success).toBe(false);
    expect(TokenResponseSchema.safeParse({ access_token: '' }).success).toBe(false);
    expect(TokenResponseSchema.parse({ access_token: 't', token_type: 'Bearer' })).toEqual({ access_token: 't' });
  });

  it('reports an unexpected response with a generic message', () => {
    expect(() => parseApiResponse(AccountSchema, { id: 1 }, 'account'))
      .toThrow('Your instance sent an unexpected response. Please try again later.');
    expect(parseApiResponse(AccountSchema, account, 'account').acct).toBe('alice');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/schemas/mastodon.test.ts`
Expected: FAIL with `Failed to resolve import "./mastodon"`.

- [ ] **Step 3: Write the implementation:** create `src/schemas/mastodon.ts`:

```ts
import { z } from 'zod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * True for an https URL (http only for a local instance in dev). Anything else coming from
 * the instance (javascript:, data:, plain http) is never put in an src attribute.
 * @param {string} value - The URL to check.
 * @returns {boolean} Whether the URL is safe to load.
 */
function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    return import.meta.env.DEV && url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

const safeUrl = z.string().refine(isSafeUrl, 'must be an https URL');

/** GET /api/v1/accounts/verify_credentials */
export const AccountSchema = z.object({
  id: z.string(),
  username: z.string(),
  acct: z.string(),
  display_name: z.string(),
  avatar: safeUrl,
});

/** A media attachment; `preview_url` falls back to `url`, a null description becomes undefined. */
export const MediaAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'gifv', 'audio', 'unknown']),
  url: safeUrl,
  preview_url: safeUrl.nullish(),
  description: z.string().nullish(),
}).transform(media => ({
  id: media.id,
  type: media.type,
  url: media.url,
  preview_url: media.preview_url ?? media.url,
  description: media.description ?? undefined,
}));

/**
 * A scheduled status. Only what the app relies on is checked; the params' other fields
 * (visibility, flags, poll...) are kept as sent, since their nullable and string forms
 * are already handled by isOnlyScheduleChange and the composer.
 */
export const ScheduledStatusSchema = z.object({
  id: z.string(),
  scheduled_at: z.string(),
  params: z.object({
    text: z.string().nullable().transform(text => text ?? ''),
  }).passthrough(),
  media_attachments: z.array(MediaAttachmentSchema),
}).passthrough();

/** POST /api/v1/apps */
export const AppRegistrationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

/** POST /oauth/token */
export const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

/**
 * Validates data received from the instance. A mismatch is logged (in dev) and reported to the
 * user with a generic message: the app never acts on a response it does not understand.
 * @param {z.ZodTypeAny} schema - The expected shape.
 * @param {unknown} data - The response body.
 * @param {string} what - What was expected, for the log.
 * @returns {z.output} The validated (and normalized) data.
 * @throws {Error} If the data does not match the schema.
 */
export function parseApiResponse<T extends z.ZodTypeAny>(schema: T, data: unknown, what: string): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`Unexpected ${what} from the instance:`, result.error.issues);
    throw new Error('Your instance sent an unexpected response. Please try again later.');
  }
  return result.data;
}
```

- [ ] **Step 4: Allow Mastodon's `unknown` media type:** in `src/types/mastodon.ts`, replace `  type: 'image' | 'video' | 'gifv' | 'audio';` with:

```ts
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/schemas/mastodon.test.ts` → `Tests  8 passed (8)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`

- [ ] **Step 6: Commit**

```bash
git add src/schemas/mastodon.ts src/schemas/mastodon.test.ts src/types/mastodon.ts
git commit -m "feat(api): add zod schemas for instance responses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/schemas/mastodon.ts", "src/schemas/mastodon.test.ts", "src/types/mastodon.ts"], "verifyCommand": "npx vitest run src/schemas/mastodon.test.ts", "acceptanceCriteria": ["unsafe avatar/media URLs refused", "media normalized", "scheduled status with null params accepted", "registration/token require credentials", "generic error on mismatch"], "requiresUserVerification": false}
```

---

### Task 2: Validate responses at the API boundary; show list errors (SEC-07)

**Goal:** Every response the app acts on is validated before use: app registration, token, account (API call and restore in the store), media upload and metadata, and the scheduled list. A malformed list shows an error the user can actually see.

**Files:**
- Modify: `src/composables/useMastodonApi.ts`
- Modify: `src/composables/useMastodonApi.test.ts` (fixtures + new `describe('response validation')`)
- Modify: `src/stores/auth.ts` (2 lines)
- Modify: `src/stores/auth.test.ts` (fixtures)
- Modify: `src/components/Toot/ScheduledToots.vue` (1 line)

**Acceptance Criteria:**
- [ ] The following throw the generic "unexpected response" error:
  - `verifyCredentials` with a `javascript:` avatar;
  - `registerApplication` without a client secret;
  - `getScheduledToots` with one malformed item. The whole list is refused rather than shown partly.
- [ ] `uploadMedia` and `updateMediaMetadata` return validated attachments. `updateMediaMetadata` now has a try/catch with `cause`, and it encodes the id
- [ ] The store's `loadAccount` validates the account. A malformed account is not stored. It is treated like a network error: the session is kept and the account stays null
- [ ] The test fixtures use complete Mastodon payloads, with no minimal `{ id }` objects
- [ ] `ScheduledToots.vue` opens its `<details>` when there is an error, even with 0 toots
- [ ] `npm test` passes, with 171 tests

**Verify:** `npx vitest run src/composables/useMastodonApi.test.ts src/stores/auth.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Update the fixtures, then add the failing tests**

In `src/composables/useMastodonApi.test.ts`:

1. Right after `import { useMastodonApi } from './useMastodonApi';`, add:

```ts
/** A scheduled status as Mastodon returns it. */
function scheduled(id: string) {
  return {
    id,
    scheduled_at: '2031-01-01T12:00:00.000Z',
    params: { text: `Toot ${id}`, visibility: 'public', language: 'en', poll: null },
    media_attachments: [],
  };
}

const uploadedMedia = { id: 'm1', type: 'image', url: 'https://masto.example/m1.png', preview_url: 'https://masto.example/m1-small.png', description: null };
```

2. Replace every minimal scheduled-status fixture:
   - `data: [{ id: '3' }, { id: '2' }]` becomes `data: [scheduled('3'), scheduled('2')]`;
   - each `data: [{ id: 'N' }]` becomes `data: [scheduled('N')]`;
   - ``data: [{ id: `id-${page}` }]`` becomes ``data: [scheduled(`id-${page}`)]``.

   This script does all three:

```bash
python3 - <<'EOF'
import re
p = 'src/composables/useMastodonApi.test.ts'
s = open(p).read()
s = re.sub(r"data: \[\{ id: '(\d)' \}, \{ id: '(\d)' \}\]", r"data: [scheduled('\1'), scheduled('\2')]", s)
s = re.sub(r"data: \[\{ id: '(\d)' \}\]", r"data: [scheduled('\1')]", s)
s = s.replace("data: [{ id: `id-${page}` }],", "data: [scheduled(`id-${page}`)],")
open(p, 'w').write(s)
EOF
grep -n "{ id: '[0-9]' }\]" src/composables/useMastodonApi.test.ts   # → no output
```

3. In the `uploadMedia` test, replace `http.post.mockResolvedValue({ data: { id: 'm1' } });` with `http.post.mockResolvedValue({ data: uploadedMedia });` and `expect(media).toEqual({ id: 'm1' });` with `expect(media).toEqual({ ...uploadedMedia, description: undefined });`.

4. Insert this block right before `  describe('rescheduleToot', () => {`:

```ts
  describe('response validation', () => {
    it('refuses an account whose avatar is not an https URL', async () => {
      http.get.mockResolvedValue({ data: { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: 'javascript:alert(1)' } });

      await expect(useMastodonApi().verifyCredentials())
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });

    it('refuses a malformed page of scheduled toots instead of showing part of it', async () => {
      http.get.mockResolvedValue({ data: [scheduled('1'), { id: 2 }], headers: {} });

      await expect(useMastodonApi().getScheduledToots())
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });

    it('refuses an app registration without a client secret', async () => {
      http.post.mockResolvedValue({ data: { client_id: 'id' } });

      await expect(useMastodonApi().registerApplication('https://masto.example'))
        .rejects.toThrow('Your instance sent an unexpected response. Please try again later.');
    });
  });
```

In `src/stores/auth.test.ts`:
- right after `import { useAuthStore } from './auth';`, add:

```ts
const ME = { id: '1', username: 'me', acct: 'me', display_name: 'Me', avatar: 'https://masto.example/me.png' };
const NEW_ACCOUNT = { id: '2', username: 'new', acct: 'new', display_name: 'New', avatar: 'https://masto.example/new.png' };
```

- replace every `{ data: { id: '1', acct: 'me' } }` with `{ data: ME }`, and `expect(auth.account).toEqual({ id: '1', acct: 'me' });` with `expect(auth.account).toEqual(ME);`;
- replace every `{ data: { id: '2', acct: 'new' } }` with `{ data: NEW_ACCOUNT }`, and `expect(auth.account).toEqual({ id: '2', acct: 'new' });` with `expect(auth.account).toEqual(NEW_ACCOUNT);`.

- [ ] **Step 2: Run them and watch the new tests fail**

Run: `npx vitest run src/composables/useMastodonApi.test.ts src/stores/auth.test.ts`
Expected: the 3 `response validation` tests FAIL. Nothing is validated yet: the `javascript:` avatar is returned as-is, the malformed list is accepted, and the registration is accepted. Everything else passes.

- [ ] **Step 3: Validate in `src/composables/useMastodonApi.ts`**

1. Replace `import axios from 'axios';` with:

```ts
import axios from 'axios';
import { z } from 'zod';
```

2. Replace `import type { MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';` with:

```ts
import type { MastodonAccount, MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
import {
  AccountSchema,
  AppRegistrationSchema,
  MediaAttachmentSchema,
  ScheduledStatusSchema,
  TokenResponseSchema,
  parseApiResponse,
} from '../schemas/mastodon';
```

3. In `registerApplication`, replace:

```ts
      if (!response.data?.client_id || !response.data?.client_secret) {
        throw new Error('Invalid response from server');
      }

      return response.data;
```

with:

```ts
      return parseApiResponse(AppRegistrationSchema, response.data, 'app registration');
```

4. In `getAccessToken`, replace:

```ts
      if (!response.data?.access_token) {
        throw new Error('Invalid response from server');
      }

      return response.data;
```

with:

```ts
      return parseApiResponse(TokenResponseSchema, response.data, 'token response');
```

5. Replace the whole `verifyCredentials` function, including its JSDoc, with:

```ts
  /**
   * Verifies the user's credentials with the Mastodon instance.
   * @returns {Promise<MastodonAccount>} The verified account data.
   * @throws {Error} If the instance URL is not set, the request fails or the account is malformed.
   */
  async function verifyCredentials(): Promise<MastodonAccount> {
    if (!auth.instance) throw new Error('No instance URL set');
    const response = await api.get(`${auth.instance}/api/v1/accounts/verify_credentials`);
    return parseApiResponse(AccountSchema, response.data, 'account');
  }
```

6. In `uploadMedia`:
   - replace `const response = await api.post<MastodonMediaAttachment>(\`${auth.instance}/api/v2/media\`, formData, {` with `const response = await api.post(\`${auth.instance}/api/v2/media\`, formData, {`;
   - replace the `return response.data;` that follows the request with `return parseApiResponse(MediaAttachmentSchema, response.data, 'media attachment');`.

7. Replace the whole `updateMediaMetadata` function (from its `* Updates the metadata for a media attachment.` JSDoc to its closing `}`) with:

```ts
  /**
   * Updates the metadata for a media attachment.
   * @param {string} id - The ID of the media attachment.
   * @param {string} [description] - Optional description for the media.
   * @param {{ x: number; y: number }} [focus] - Optional focus coordinates for the media.
   * @returns {Promise<MastodonMediaAttachment>} The updated media attachment.
   * @throws {Error} If the instance URL is not set, the request fails or the response is malformed.
   */
  async function updateMediaMetadata(id: string, description?: string, focus?: { x: number; y: number }): Promise<MastodonMediaAttachment> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      const response = await api.put(`${auth.instance}/api/v1/media/${encodeURIComponent(id)}`, {
        description,
        focus,
      });
      return parseApiResponse(MediaAttachmentSchema, response.data, 'media attachment');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }
```

8. In `getScheduledToots`, replace:

```ts
        const response = await api.get<MastodonStatus[]>(url);
        if (response.data.length === 0) break;
        toots.push(...response.data);
```

with:

```ts
        const response = await api.get(url);
        const page = parseApiResponse(z.array(ScheduledStatusSchema), response.data, 'scheduled toots');
        if (page.length === 0) break;
        // Validated shape; MastodonStatus is the app's (looser) view of a scheduled status.
        toots.push(...(page as unknown as MastodonStatus[]));
```

- [ ] **Step 4: Validate the restored account in `src/stores/auth.ts`**

Add this right after `import type { MastodonAccount } from '../types/mastodon';`:

```ts
import { AccountSchema, parseApiResponse } from '../schemas/mastodon';
```

In `loadAccount`, replace:

```ts
      if (accessToken.value === session.accessToken) account.value = response.data;
```

with:

```ts
      const verified = parseApiResponse(AccountSchema, response.data, 'account');
      if (accessToken.value === session.accessToken) account.value = verified;
```

A malformed account throws inside the try. That is not a 401, so the existing catch keeps the session and leaves `account` null.

- [ ] **Step 5: Make list errors visible:** in `src/components/Toot/ScheduledToots.vue`, replace `:open="store.count > 0"` with:

```html
      :open="store.count > 0 || !!store.error"
```

Before this change, an error loading the list sat inside a collapsed `<details>` whenever there were 0 toots, so the user never saw it. The Playwright dry run caught this.

- [ ] **Step 6: Verify**

```bash
npx vitest run src/composables/useMastodonApi.test.ts src/stores/auth.test.ts
npm run typecheck; echo "exit=$?"
npm test
npm run lint
```

Expected: all pass, `exit=0`, `Tests  171 passed (171)`, `0 errors`.

- [ ] **Step 7: Commit**

```bash
git add src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts src/stores/auth.ts src/stores/auth.test.ts src/components/Toot/ScheduledToots.vue
git commit -m "fix(api): validate instance responses before use; show list errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts", "src/stores/auth.ts", "src/stores/auth.test.ts", "src/components/Toot/ScheduledToots.vue"], "verifyCommand": "npx vitest run src/composables/useMastodonApi.test.ts src/stores/auth.test.ts", "acceptanceCriteria": ["malformed account / registration / list refused with generic error", "media responses validated; updateMediaMetadata keeps cause and encodes id", "restored account validated", "complete fixtures", "list error visible with 0 toots", "171 tests"], "requiresUserVerification": false}
```

---

### Task 3: Check uploads before sending; keep every file of a multi-upload (SEC-11, BUG-10)

**Goal:** A dropped or picked file that isn't a supported image, or is over 8 MB, is refused before any request. Uploading several files keeps all of them. Progress entries are keyed per upload, not per file name.

**Files:**
- Create: `src/utils/media.ts`
- Test: `src/utils/media.test.ts`
- Modify: `src/components/MediaUpload.vue` (script: imports, `uploadProgress`, `uploadFiles`; template: `accept`, progress list)
- Test: `src/components/MediaUpload.test.ts`

**Acceptance Criteria:**
- [ ] `getImageRejection` accepts JPEG, PNG, GIF, WebP, AVIF and HEIC/HEIF up to 8 MB. It refuses other types (SVG and missing types included) with `"<name>" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).` and larger files with `"<name>" is larger than 8 MB.`
- [ ] A dropped PDF is refused without calling `uploadMedia`
- [ ] Two files with the same name, uploaded together, end up as two attachments
- [ ] More than 4 images in total are refused, as before

**Verify:** `npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts` → `Tests  6 passed (6)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/utils/media.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getImageRejection, MAX_IMAGE_BYTES } from './media';

function file(name: string, type: string, size = 10): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

describe('getImageRejection', () => {
  it('accepts the image types Mastodon supports', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic']) {
      expect(getImageRejection(file('a', type))).toBeNull();
    }
  });

  it('refuses other types, including SVG and a missing type', () => {
    expect(getImageRejection(file('doc.pdf', 'application/pdf'))).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
    expect(getImageRejection(file('logo.svg', 'image/svg+xml'))).not.toBeNull();
    expect(getImageRejection(file('noext', ''))).not.toBeNull();
  });

  it('refuses an image over 8 MB', () => {
    expect(getImageRejection(file('big.png', 'image/png', MAX_IMAGE_BYTES + 1))).toBe('"big.png" is larger than 8 MB.');
    expect(getImageRejection(file('max.png', 'image/png', MAX_IMAGE_BYTES))).toBeNull();
  });
});
```

Create `src/components/MediaUpload.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { MastodonMediaAttachment } from '../types/mastodon';

const api = vi.hoisted(() => ({ uploadMedia: vi.fn(), updateMediaMetadata: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import MediaUpload from './MediaUpload.vue';

function media(id: string): MastodonMediaAttachment {
  return { id, type: 'image', url: `https://masto.example/${id}.png`, preview_url: `https://masto.example/${id}.png` };
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.find('.upload-area').trigger('drop', { dataTransfer: { files } });
}

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('refuses a dropped file that is not a supported image, without uploading it', async () => {
    const wrapper = mount(MediaUpload, { props: { modelValue: [] } });

    await drop(wrapper, [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
  });

  it('keeps every image when several are uploaded at once', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockResolvedValueOnce(media('m2'));
    const wrapper = mount(MediaUpload, { props: { modelValue: [] } });

    await drop(wrapper, [
      new File(['a'], 'same.png', { type: 'image/png' }),
      new File(['b'], 'same.png', { type: 'image/png' }),
    ]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1', 'm2']);
  });

  it('refuses more than 4 images', async () => {
    const wrapper = mount(MediaUpload, { props: { modelValue: [media('a'), media('b'), media('c')] } });

    await drop(wrapper, [new File(['a'], '1.png', { type: 'image/png' }), new File(['b'], '2.png', { type: 'image/png' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Maximum 4 images allowed');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts`
Expected:
- `media.test.ts` cannot resolve `./media`;
- the dropped PDF is uploaded;
- the multi-upload ends with only `['m2']`. Each emit used the stale `props.modelValue`, which is BUG-10.

- [ ] **Step 3: Create `src/utils/media.ts`:**

```ts
/** Image types Mastodon accepts that this app lets users attach. */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit (instances may allow more). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon allows up to 4 media attachments per toot. */
export const MAX_IMAGES_PER_TOOT = 4;

/**
 * Explains why a file can't be attached, or returns null when it can. Checked before
 * uploading, including for drag and drop where the file picker's `accept` doesn't apply;
 * the instance stays the final authority.
 * @param {File} file - The file to check.
 * @returns {string | null} A message for the user, or null.
 */
export function getImageRejection(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return `"${file.name}" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is larger than 8 MB.`;
  }
  return null;
}
```

- [ ] **Step 4: Update `src/components/MediaUpload.vue`**

1. Add this after `import ModalView from './Modals/ModalView.vue';`:

```ts
import { getImageRejection, MAX_IMAGES_PER_TOOT, SUPPORTED_IMAGE_TYPES } from '../utils/media';
```

2. Replace `const uploadProgress = ref<{ [key: string]: number }>({});` with:

```ts
/** Upload progress per upload, keyed by a random id (two files can share a name). */
const uploadProgress = ref<Record<string, { name: string; percent: number }>>({});
```

3. Replace the whole `uploadFiles` function with:

```ts
async function uploadFiles(files: File[]) {
  uploadError.value = '';

  // Checked before uploading: drag and drop bypasses the file picker's `accept`.
  const rejection = files.map(getImageRejection).find(message => message !== null);
  if (rejection) {
    uploadError.value = rejection;
    return;
  }
  if (props.modelValue.length + files.length > MAX_IMAGES_PER_TOOT) {
    uploadError.value = `Maximum ${MAX_IMAGES_PER_TOOT} images allowed`;
    return;
  }

  isUploading.value = true;
  // Accumulated locally: the prop only updates after the parent re-renders.
  const attachments = [...props.modelValue];

  try {
    for (const file of files) {
      const key = crypto.randomUUID();
      uploadProgress.value[key] = { name: file.name, percent: 0 };

      const media = await api.uploadMedia(file, (percent) => {
        uploadProgress.value[key] = { name: file.name, percent };
      });

      attachments.push(media);
      emit('update:modelValue', [...attachments]);
      delete uploadProgress.value[key];
    }
  } catch (err) {
    uploadError.value = err instanceof Error && err.message ? err.message : 'Failed to upload images';
    console.error('Upload error:', err);
  } finally {
    isUploading.value = false;
    uploadProgress.value = {};
  }
}
```

4. In the template, replace `accept="image/*"` with:

```html
        :accept="SUPPORTED_IMAGE_TYPES.join(',')"
```

5. In the template, replace the progress list item:

```html
      <div
        v-for="(progress, fileName) in uploadProgress"
        :key="fileName"
        class="progress-item"
      >
        <div class="progress-info">
          <span class="file-name">{{ fileName }}</span>
          <span class="progress-percentage">{{ Math.round(progress) }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
```

with:

```html
      <div
        v-for="(progress, key) in uploadProgress"
        :key="key"
        class="progress-item"
      >
        <div class="progress-info">
          <span class="file-name">{{ progress.name }}</span>
          <span class="progress-percentage">{{ Math.round(progress.percent) }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>
      </div>
```

- [ ] **Step 5: Verify**

```bash
npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts
npm run typecheck; echo "exit=$?"
npm test
```

Expected: `Tests  6 passed (6)`, `exit=0`, `Tests  177 passed (177)`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/media.ts src/utils/media.test.ts src/components/MediaUpload.vue src/components/MediaUpload.test.ts
git commit -m "fix(media): check image type and size before uploading; keep every file of a multi-upload

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/media.ts", "src/utils/media.test.ts", "src/components/MediaUpload.vue", "src/components/MediaUpload.test.ts"], "verifyCommand": "npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts", "acceptanceCriteria": ["supported types and 8 MB checked before upload, drop included", "multi-upload keeps all files", "unique progress keys", "max 4 images"], "requiresUserVerification": false}
```

---

### Task 4: "Say Thanks" asks for confirmation, sends exactly what it shows, and reports failures (SEC-12, BUG-11, D4)

**Goal:**
- Clicking "Say Thanks" opens a dialog showing the exact direct message and its recipient.
- Cancel sends nothing; Send posts exactly that text as a direct message.
- A failure shows an error toast with the instance's reason, instead of a false success.

**Files:**
- Modify: `src/config/constants.ts`
- Create: `src/utils/thanks.ts`
- Test: `src/utils/thanks.test.ts`
- Create: `src/components/Modals/ThanksConfirmModal.vue`
- Test: `src/components/Modals/ThanksConfirmModal.test.ts`
- Modify: `src/composables/useMastodonApi.ts` (replace `sendDirectMessageAsUser` and `sendDirectThanksNotification` with `sendThanks`; returned object)
- Modify: `src/composables/useMastodonApi.test.ts` (new `describe('sendThanks')`)
- Modify: `src/App.vue`

**Acceptance Criteria:**
- [ ] `buildThanksMessage(name, date)` names the sender, ends with `CC: @dams@disabled.social` and has no space before a line break, so the preview equals what is sent
- [ ] `ThanksConfirmModal` renders the message as text (no HTML) and emits `confirm` or `cancel`
- [ ] `sendThanks(message)` posts `{ status: message, visibility: 'direct' }` and rethrows errors with the instance's reason. No internal swallowing and no `console.log` of the response
- [ ] `App.vue`:
  - both Thanks buttons (desktop and mobile) open the dialog;
  - Cancel and close send nothing;
  - Send closes the dialog first, which prevents a double send, then toasts success or `Failed to send thanks (<reason>). Please try again later.`
- [ ] typecheck, lint (0 errors) and tests pass (183)

**Verify:** `npx vitest run src/utils/thanks.test.ts src/components/Modals/ThanksConfirmModal.test.ts src/composables/useMastodonApi.test.ts` → all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/utils/thanks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildThanksMessage } from './thanks';

describe('buildThanksMessage', () => {
  it('names the sender and mentions the app author', () => {
    const message = buildThanksMessage('Alice', new Date('2030-01-01T12:00:00Z'));
    expect(message.startsWith('🤗 Alice is sending you a thank you!')).toBe(true);
    expect(message.endsWith('CC: @dams@disabled.social')).toBe(true);
  });

  it('has no trailing spaces, so the preview shows exactly what is sent', () => {
    expect(buildThanksMessage('Alice', new Date())).not.toMatch(/ \n/);
  });
});
```

Create `src/components/Modals/ThanksConfirmModal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ThanksConfirmModal from './ThanksConfirmModal.vue';

describe('ThanksConfirmModal', () => {
  it('shows the exact message as text', () => {
    const wrapper = mount(ThanksConfirmModal, { props: { message: '<b>Hi</b> CC: @dams@disabled.social' } });
    expect(wrapper.find('.thanks-preview').text()).toBe('<b>Hi</b> CC: @dams@disabled.social');
    expect(wrapper.find('.thanks-preview b').exists()).toBe(false);
  });

  it('emits confirm or cancel', async () => {
    const wrapper = mount(ThanksConfirmModal, { props: { message: 'Hi' } });
    await wrapper.find('.btn-send').trigger('click');
    await wrapper.find('.btn-cancel').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
```

In `src/composables/useMastodonApi.test.ts`, insert this right before `  describe('rescheduleToot', () => {`:

```ts
  describe('sendThanks', () => {
    it('sends the previewed message as a direct message', async () => {
      http.post.mockResolvedValue({ data: { id: 'dm' } });

      await useMastodonApi().sendThanks('🤗 Thanks! CC: @dams@disabled.social');

      expect(http.post).toHaveBeenCalledWith('https://masto.example/api/v1/statuses', {
        status: '🤗 Thanks! CC: @dams@disabled.social',
        visibility: 'direct',
      });
    });

    it('reports a failure instead of hiding it', async () => {
      http.post.mockRejectedValue({ isAxiosError: true, message: 'Request failed', response: { status: 422, data: { error: 'Text too long' } } });

      await expect(useMastodonApi().sendThanks('Thanks')).rejects.toThrow('Text too long');
    });
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/thanks.test.ts src/components/Modals/ThanksConfirmModal.test.ts src/composables/useMastodonApi.test.ts`
Expected: the new modules can't be resolved, and `sendThanks` is not a function.

- [ ] **Step 3: Add the recipient constant.** Append this to `src/config/constants.ts`:

```ts

/** Who receives the "Say Thanks" direct message: the app's author. */
export const THANKS_RECIPIENT = '@dams@disabled.social';
```

- [ ] **Step 4: Create `src/utils/thanks.ts`:**

```ts
import { THANKS_RECIPIENT } from '../config/constants';

/**
 * Builds the "thank you" direct message, shown to the user before it is sent.
 * @param {string} senderName - The user's display name (or handle).
 * @param {Date} now - When it is sent.
 * @returns {string} The message, mentioning its recipient.
 */
export function buildThanksMessage(senderName: string, now: Date): string {
  return `🤗 ${senderName} is sending you a thank you!\nToday at ${now.toLocaleString()}\nCC: ${THANKS_RECIPIENT}`;
}
```

- [ ] **Step 5: Create `src/components/Modals/ThanksConfirmModal.vue`.** It mirrors `DeleteConfirmModal.vue`: same layout, neutral Cancel and dark primary Send, following the ui-design-system skill.

```vue
<script setup lang="ts">
defineProps<{
  message: string;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<template>
  <div class="thanks-confirm">
    <h2 class="thanks-title">
      Send a thank-you?
    </h2>
    <p class="thanks-description">
      This sends the following direct message from your account to the app's author:
    </p>
    <blockquote class="thanks-preview">
      {{ message }}
    </blockquote>
    <div class="thanks-actions">
      <button
        class="btn-cancel"
        type="button"
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        class="btn-send"
        type="button"
        @click="emit('confirm')"
      >
        Send
      </button>
    </div>
  </div>
</template>

<style scoped>
.thanks-confirm {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.thanks-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #333;
  margin: 0;
  padding-right: 2rem; /* avoid overlap with ModalView close button */
}

.thanks-description {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

.thanks-preview {
  margin: 0;
  padding: 0.75rem 1rem;
  background-color: #f8f8f8;
  border-left: 3px solid #ccc;
  border-radius: 0 4px 4px 0;
  font-size: 0.9rem;
  color: #333;
  white-space: pre-line;
}

.thanks-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn-cancel,
.btn-send {
  flex: 1;
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 3rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-send {
  background-color: #333;
  color: white;
}

.btn-send:hover {
  background-color: #222;
}
</style>
```

- [ ] **Step 6: Replace the DM functions in `src/composables/useMastodonApi.ts`.** Replace everything from the `/**` of `* Sends a direct message to the user.` up to, but not including, the `/**` of `* Uploads media to the Mastodon instance.` (this removes `sendDirectMessageAsUser` and `sendDirectThanksNotification`) with:

```ts
  /**
   * Sends the "thank you" direct message, exactly as previewed to the user.
   * @param {string} message - The message, which mentions its recipient.
   * @returns {Promise<void>} Resolves once the instance accepted the message.
   * @throws {Error} If the request fails, so the UI can tell the user.
   */
  async function sendThanks(message: string): Promise<void> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      await api.post(`${auth.instance}/api/v1/statuses`, {
        status: message,
        // 'direct': only the mentioned account sees it
        visibility: 'direct',
      });
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }
```

In the returned object, replace:

```ts
    /**
     * Sends a direct thank you notification to the user.
     * @returns {Promise<void>} A promise that resolves when the notification is sent.
     */
    sendDirectThanksNotification,
```

with:

```ts
    /**
     * Sends the previewed "thank you" direct message.
     * @param {string} message - The message.
     * @returns {Promise<void>} Resolves once sent.
     */
    sendThanks,
```

- [ ] **Step 7: Wire `src/App.vue`**

1. Replace `import WhatsNew from './components/Modals/WhatsNew.vue';` with:

```ts
import WhatsNew from './components/Modals/WhatsNew.vue';
import ThanksConfirmModal from './components/Modals/ThanksConfirmModal.vue';
import { buildThanksMessage } from './utils/thanks';
```

2. Replace the whole `sendThanksNotification` function with:

```ts
/** The "thank you" message awaiting confirmation; null when the dialog is closed. */
const thanksMessage = ref<string | null>(null);

function openThanks(): void {
  isMenuOpen.value = false;
  const sender = auth.account?.display_name || auth.account?.acct || 'Someone';
  thanksMessage.value = buildThanksMessage(sender, new Date());
}

function cancelThanks(): void {
  thanksMessage.value = null;
}

async function confirmThanks(): Promise<void> {
  const message = thanksMessage.value;
  thanksMessage.value = null; // closes the dialog and prevents a second send
  if (!message) return;

  try {
    await mastodonApi.sendThanks(message);
    toast.success('Thanks sent successfully! 🤗');
  } catch (error) {
    const reason = error instanceof Error && error.message ? ` (${error.message})` : '';
    toast.error(`Failed to send thanks${reason}. Please try again later.`);
  }
}
```

3. Replace both `@click="sendThanksNotification"` with `@click="openThanks"` (desktop and mobile buttons). Check that `grep -c 'openThanks' src/App.vue` returns 3.

4. Right after the What's New `</ModalView>`, add:

```html

    <ModalView
      :is-open="thanksMessage !== null"
      @close-modal="cancelThanks"
    >
      <ThanksConfirmModal
        :message="thanksMessage ?? ''"
        @confirm="confirmThanks"
        @cancel="cancelThanks"
      />
    </ModalView>
```

- [ ] **Step 8: Verify**

```bash
npx vitest run src/utils/thanks.test.ts src/components/Modals/ThanksConfirmModal.test.ts src/composables/useMastodonApi.test.ts
npm run typecheck; echo "exit=$?"
npm test
npm run lint
grep -n "sendDirectThanksNotification\|sendDirectMessageAsUser\|sendThanksNotification" -r src   # → no output
```

Expected: all pass, `exit=0`, `Tests  183 passed (183)`, `0 errors`.

- [ ] **Step 9: Commit**

```bash
git add src/config/constants.ts src/utils/thanks.ts src/utils/thanks.test.ts src/components/Modals/ThanksConfirmModal.vue src/components/Modals/ThanksConfirmModal.test.ts src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts src/App.vue
git commit -m "feat(thanks): confirm before sending the thank-you DM and report failures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/config/constants.ts", "src/utils/thanks.ts", "src/utils/thanks.test.ts", "src/components/Modals/ThanksConfirmModal.vue", "src/components/Modals/ThanksConfirmModal.test.ts", "src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts", "src/App.vue"], "verifyCommand": "npx vitest run src/utils/thanks.test.ts src/components/Modals/ThanksConfirmModal.test.ts src/composables/useMastodonApi.test.ts", "acceptanceCriteria": ["message names sender, mentions recipient, no trailing spaces", "modal shows text, emits confirm/cancel", "sendThanks posts direct, rethrows", "App: dialog, cancel sends nothing, send once, real error toast", "183 tests"], "requiresUserVerification": false}
```

---

### Task 5: Content Security Policy in production; inline script moved out (SEC-03, WEB-04)

**Goal:**
- The production `index.html` carries a strict CSP: no inline or eval script, `object-src 'none'`, https-only instance traffic.
- The GitHub Pages deep-link redirect still works from an external file.
- The README documents the CSP.

**Files:**
- Create: `public/spa-redirect.js`
- Modify: `index.html` (inline `<script>` → `<script src>`)
- Modify: `vite.config.ts` (CSP plugin)
- Modify: `README.md` (Security section)

**Acceptance Criteria:**
- [ ] `dist/index.html` starts its `<head>` with `<meta http-equiv="Content-Security-Policy" ...>`. The policy contains `script-src 'self'` with no `unsafe-inline` or `unsafe-eval`, plus `object-src 'none'`, `base-uri 'self'` and `form-action 'self'`
- [ ] `dist/index.html` contains no inline `<script>` (every script has `src`)
- [ ] `npm run dev` has no CSP: the plugin uses `apply: 'build'`
- [ ] `/toots-scheduler/?redirect=composer` still restores the path. Task 7 checks this in a browser
- [ ] The README Security section mentions the CSP

**Verify:** `npm run build && grep -c 'http-equiv="Content-Security-Policy"' dist/index.html && ! grep -qE '<script>' dist/index.html && echo "csp ok"` → `1` then `csp ok`

**Steps:**

- [ ] **Step 1: Check the baseline**

Run: `npm run build && grep -c 'Content-Security-Policy' dist/index.html; grep -c '<script>' dist/index.html`
Expected: `0`, then `1` (the inline redirect script).

- [ ] **Step 2: Create `public/spa-redirect.js`:**

```js
// GitHub Pages serves 404.html for deep links; it redirects to the app with ?redirect=<path>.
// Restore that path before the app starts. Kept in a file (not inline) for the CSP.
(function () {
  var redirect = new URLSearchParams(window.location.search).get('redirect');
  if (redirect) {
    var cleanRedirect = redirect.replace(/^\/+/, '');
    window.history.replaceState(null, '', '/toots-scheduler/' + cleanRedirect);
  }
})();
```

- [ ] **Step 3: `index.html`:** replace the whole inline block, from `    <script>` (the one with `// Handle redirect from 404.html`) to its `    </script>`, with:

```html
    <script src="/toots-scheduler/spa-redirect.js"></script>
```

It stays in `<head>`, so it runs before the app module, as before.

- [ ] **Step 4: Replace the whole of `vite.config.ts`** with:

```ts
/// <reference types="node" />
/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
/**
 * Content Security Policy for the production build. GitHub Pages can't send headers, so it
 * is a <meta> tag (which ignores frame-ancestors). Only scripts from this site may run;
 * the instance is reached over https (connect-src) and serves images and media over https.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "media-src 'self' https:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

/** Adds the CSP to index.html at build time only: the dev server needs inline scripts and websockets. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [vue(), contentSecurityPolicy()],
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

- [ ] **Step 5: README:** in the `## Security` section, replace the `- **Known trade-off:**` bullet with:

```markdown
- **Content Security Policy:** the production page only runs this site's own scripts (no inline or injected script, no plugins), talks to instances over https only, and loads images and media over https. GitHub Pages can't send headers, so the policy is a `<meta>` tag; clickjacking protection (`frame-ancestors`) isn't available there.
- **Known trade-off:** while you are signed in, a script running on this page could read the token. That is the price of having no backend; the CSP above makes injecting one much harder. The app never renders HTML coming from the API (`v-html` is forbidden by the linter), checks every response from the instance before using it, and the production build contains no console output.
```

- [ ] **Step 6: Verify**

```bash
npm run typecheck; echo "exit=$?"
npm run build 2>&1 | tail -3
grep -c 'http-equiv="Content-Security-Policy"' dist/index.html
grep -c '<script>' dist/index.html
ls dist/spa-redirect.js
npm test
```

Expected:
- `exit=0`;
- the build shows the expected warning about `spa-redirect.js`, then `✓ built`;
- the CSP grep returns `1` and the inline-script grep returns `0`;
- the file exists;
- tests pass.

- [ ] **Step 7: Commit**

```bash
git add public/spa-redirect.js index.html vite.config.ts README.md
git commit -m "feat(security): add a strict CSP to the production page; move the inline redirect script out

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["public/spa-redirect.js", "index.html", "vite.config.ts", "README.md"], "verifyCommand": "npm run build && grep -c 'http-equiv=\"Content-Security-Policy\"' dist/index.html", "acceptanceCriteria": ["CSP meta first in head, strict script-src", "no inline script in dist", "no CSP in dev", "redirect script external", "README documents CSP"], "requiresUserVerification": false}
```

---

### Task 6: Release 0.15.0

**Goal:** Version 0.15.0 (MINOR: new confirmation dialog, visible security changes), with "What's New" entries.

**Files:** Modify `package.json`, `package-lock.json`, `src/stores/features.ts`

**Acceptance Criteria:**
- [ ] The version is `0.15.0` in `package.json` and in the first FeatureGroup
- [ ] The 3 new ids are unique
- [ ] lint (0 errors), typecheck, test and build pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.15.0`

**Steps:**

- [ ] **Step 1:** Read `.claude/skills/changelog/SKILL.md`.
- [ ] **Step 2:** Run `npm version minor --no-git-tag-version`. Expected output: `v0.15.0`.
- [ ] **Step 3:** Run `grep -nE "confirm-thanks|safer-uploads|stricter-security" src/stores/features.ts`. Expected: no output.
- [ ] **Step 4:** Prepend this group at the top of the `features` array (before `version: '0.14.0'`):

```ts
    {
      version: '0.15.0',
      date: '2026-10-04',
      features: [
        {
          id: 'confirm-thanks',
          title: '💌 Say Thanks, With a Preview',
          description: 'Say Thanks now shows you the exact message before it is sent, and tells you if it could not be delivered.'
        },
        {
          id: 'safer-uploads',
          title: '🖼️ Clearer Image Uploads',
          description: 'Files that are not supported images, or are larger than 8 MB, are refused right away with a clear message, and dropping several images at once keeps all of them.'
        },
        {
          id: 'stricter-security',
          title: '🛡️ Stricter Security',
          description: 'The app now only runs its own code and checks everything your instance sends back before using it.'
        },
      ],
    },
```

- [ ] **Step 5:** Run `npm run lint && npm run typecheck && npm test && npm run build`. Expected: all pass.
- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts
git commit -m "chore(release): 0.15.0 — CSP, validated responses, safer uploads, confirmed thanks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.15.0 everywhere", "3 unique ids", "lint, typecheck, test, build pass"], "requiresUserVerification": false}
```

---

### Task 7: End-to-end verification by the controller; report to the user

**Goal:** The controller, not a subagent, runs the Playwright suite on the production build against the mocked instance. The run covers the 16 Lot 2 checks as a regression and the Lot 3 checks, plus a CSP-violation listener over every flow. The controller then reports results and what can't be tested without a real instance, and asks the user.

**Files:** none in the repo. The suite lives in the session scratchpad (`e2e/e2e.mjs`).

**Acceptance Criteria:**
- [ ] `npm run build`, then `npx vite preview --port 4173 --strictPort`, then `node e2e.mjs` → all checks pass:
  - 16 Lot 2 checks;
  - L3-1 CSP present with no inline script;
  - L3-2 malformed account refused, no session kept, nothing rendered;
  - L3-3 malformed list shows a visible error;
  - L3-4 dropped SVG refused before upload;
  - L3-5 two same-name images both attached;
  - L3-6 Thanks confirmation, cancel and exact DM, failure reported;
  - L3-7 `?redirect=composer` deep link works under the CSP;
  - L3-8 **zero CSP violations** across all flows
- [ ] The user has been told what the run proves and what still needs a real instance

**Verify:** the e2e output ends with `24/24 passed`

**Steps:**

- [ ] **Step 1:** Build, serve the production build, and run the suite. Look at the screenshots in `e2e/shots/`.
- [ ] **Step 2:** Report to the user. These checks cannot be done without a real instance:
  1. The real instance's CORS and its images under the CSP: sign in, then check that the avatar, the media previews and the scheduled list load, and that the DevTools console shows no `Content Security Policy` error.
  2. A real image upload is accepted, and the instance refuses a type it doesn't support.
  3. The "Say Thanks" DM really arrives (a real direct message to @dams@disabled.social).
  4. The deployed GitHub Pages site serves `spa-redirect.js` and a deep link (e.g. `/toots-scheduler/composer` opened directly) works.

**User Verification Required:**
Before marking this task complete, you MUST call AskUserQuestion:
```yaml
AskUserQuestion:
  question: "The 24 automated checks pass (no CSP violation). Do the real-instance checks pass (avatar/media/list load with no CSP error in the console, real upload, Thanks DM delivered, deep link on the deployed site)?"
  header: "Verification"
  options:
    - label: "All checks pass"
      description: "Lot 3 is validated: close and publish the PR"
    - label: "A check fails"
      description: "Tell me which one and what you saw; back to fixing, then re-verification"
    - label: "Publish, check later"
      description: "Publish the PR now, with the real-instance checks left unchecked in its test plan"
```

```json:metadata
{"files": [], "verifyCommand": "node e2e.mjs", "acceptanceCriteria": ["24/24 automated checks pass incl. zero CSP violations", "user informed of real-instance checks and answered"], "requiresUserVerification": true, "userVerificationPrompt": "The 24 automated checks pass (no CSP violation). Do the real-instance checks pass (avatar/media/list load with no CSP error in the console, real upload, Thanks DM delivered, deep link on the deployed site)?"}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. The user already asked for the PR to be published: push `fix/lot-3-defense-in-depth` and open the PR with base `fix/lot-2-auth-hardening`.

## Self-review notes

- **Spec coverage (Lot 3):**
  - Inline script moved to `public/spa-redirect.js` (WEB-04) → Task 5.
  - CSP `<meta>` → Task 5. It is generated at build time, so it doesn't break the dev server.
  - zod schemas, `safeParse` in each API function, generic error, https image URLs (SEC-07) → Tasks 1 and 2.
  - Upload type whitelist before sending, drop included, plus a random progress key (SEC-11, BUG-10) → Task 3.
  - Thanks confirmation modal (D4), error propagated, recipient as a constant (SEC-12, BUG-11) → Task 4.
  - Spec tests:
    - schemas (valid accepted, non-array media refused, `javascript:` avatar refused) → Task 1;
    - dropped PDF → no API call (Task 3);
    - failed thanks → error toast (Task 4 plus Task 7 L3-6).
  - "No CSP violation in the console" → Task 7 L3-8, automated.
- **Deviations from the spec (justified):**
  - Types are not fully derived with `z.infer`. Scheduled statuses are validated on the fields the app relies on and then cast to `MastodonStatus`. Making `MastodonStatus` match the API (nullable params) would ripple through every component, so it is left for Lot 5 (types).
  - The upload whitelist adds HEIC/HEIF, which Mastodon accepts, and refuses SVG explicitly.
  - The scheduled-toots error visibility fix (`<details>` opening on error) was found by the Playwright dry run and added to Task 2.
  - The thanks message lost the spaces before its line breaks, so the preview is exactly the sent text.
- **Known residuals:**
  - `frame-ancestors` (clickjacking) is impossible with a `<meta>` CSP on GitHub Pages.
  - `style-src 'unsafe-inline'` is kept for Vue style bindings and vue-toastification.
  - `public/404.html` keeps inline scripts and has no CSP; it only redirects.
  - The dev server has no CSP.
  - The Playwright suite stays in the session scratchpad; adding it to the repo with CI is a follow-up.
