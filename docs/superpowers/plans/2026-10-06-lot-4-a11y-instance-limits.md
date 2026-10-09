# Lot 4 — Accessibility & Instance Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app usable with the keyboard and a screen reader, and let the instance, not hard-coded numbers, set the composer's limits:
- dialogs, the mobile menu and the page structure become accessible;
- the composer gets live regions, alerts, labels and readable contrast;
- toot cards get unique ids and progress shown on the right card;
- toot length and image count, size and types are read from `GET /api/v2/instance`;
- the time zone is shown.

**Architecture:**
- **Instance limits:** a new `instance` setup store watches the session token. On sign-in, a restored session or an account switch, it resets to the defaults, then loads `GET /api/v2/instance` through the shared API client. A lenient zod schema drops any missing or invalid field, so each limit falls back on its own. The composer, the counter and the upload read the store. The upload check (`getImageRejection(file, limits)`) is a pure function of the file and the limits. The image types are the instance's list kept to Lot 3's supported images, and `accept` is derived from them.
- **Dialogs:** `ModalView` is named by its heading (`labelledBy`), focuses its first field or action, closes on Escape and returns focus only after a real opening. Every dialog emits one `close` event.
- **Page and menu:** `App.vue` owns the single `<main>`, each view owns its `<h1>`, and the burger menu becomes a small, tested `MobileNav` component.
- **Composer:** a polite live region speaks only at steps near the limit; errors are `role="alert"`; the icon toggles get hidden labels and follow the composer's state. Colors that axe flags are replaced with existing palette values.
- **Cards:** `pendingId` and `pendingAction` in the scheduled-toots store replace the global loading flag, so only the toot concerned shows progress. Cards emit `edit` and `delete`.

**Tech Stack:** Vue 3.5, TypeScript 5.7, Pinia 2 (setup stores), zod 3.24 (already a dependency), Vitest 4 + @vue/test-utils + happy-dom, Playwright + axe-core 4.14 (scratchpad only, for the controller's end-to-end run).

**User Verification:** YES. Task 9 is the gate. The controller extends its Playwright suite and runs it on the production build: a keyboard-only journey, axe scans, mocked limits and their fallback, plus the 24 existing checks with the CSP listener. It then reports, and asks the user to check what only they can:
- a real instance with more than 500 characters;
- a VoiceOver pass;
- Lighthouse accessibility of at least 95.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 4:
- WEB-01 (accessibility);
- WEB-07 (time zone);
- BUG-06 (duplicate ids);
- BUG-08 (hard-coded limits);
- BUG-09 (dead event wiring);
- CC-10 (misleading labels).

Audit: [docs/audits/2026-10-01-red-team-report.md](../../audits/2026-10-01-red-team-report.md).

---

## Context the engineer needs

- **Branch:** `fix/lot-4-a11y-instance-limits`, stacked on Lot 3. Open the PR against `fix/lot-3-defense-in-depth`, or against `main` if Lot 3 has been merged by then.
- **Quality commands:**
  - `npm run lint` must report 0 errors; it reports 4 warnings today, which stay;
  - `npm run typecheck` (`vue-tsc -b`; it also checks the `*.test.ts` files);
  - `npm test`, which has 196 tests at the start;
  - `npm run build`.

  Tests live next to their sources (`*.test.ts`) and import from `'vitest'` explicitly.
- **Commits:** one commit per task, with the exact `git add` paths given. **Never stage `*.tasks.json`**, and never use `git add -A` or `git add .`.
- **Shell:** the user's shell is zsh. Quote globs in commands, as in `--include='*.vue'`.
- **Skills:** read `.claude/skills/vue3-codegen/SKILL.md`, `.claude/skills/ui-design-system/SKILL.md`, `.claude/skills/mastodon-api/SKILL.md` (Task 1), `.claude/skills/web-security/SKILL.md` (§4 uploads, §8 API responses) and `.claude/skills/changelog/SKILL.md` (Task 8).
- **Mastodon facts** ([docs](https://docs.joinmastodon.org/methods/instance/#v2)):
  - `GET /api/v2/instance` exists since Mastodon 4.0 and is public: no token or scope is needed. Older versions and some other servers answer 404, and the defaults then apply.
  - The fields used are:
    - `configuration.statuses.max_characters` (default 500);
    - `configuration.statuses.max_media_attachments` (default 4);
    - `configuration.media_attachments.image_size_limit`, in bytes (16 MB on Mastodon 4.x; the app's fallback stays Lot 3's 8 MB);
    - `configuration.media_attachments.supported_mime_types`, which also lists video and audio types.
  - The shared client sends the token only to the signed-in instance, which this is. A 401 there means the token was rejected and ends the session, as everywhere else. The CSP's `connect-src https:` already allows the call.
  - Mastodon counts each URL as 23 characters and includes the content warning in the limit. The app counts raw characters (see residuals).
- **happy-dom facts** (learned in the dry run):
  - `trigger('click')` on a checkbox does not fire `change`, so the composer's toggles listen to `click`;
  - focus checks need `attachTo: document.body`;
  - string slots need Vue's template compiler, so tests use render functions (`h()`);
  - no CSS is computed: contrast is checked by axe in Task 9.
- **Dry run:** every code block below was dry-run on a scratch clone of this branch.
  - Unit checks (final, after the review and Safari fixes): 362 tests pass, typecheck is clean, lint reports 0 errors and 4 warnings, and the build succeeds.
  - axe-core 4.14 was run with Playwright on the production build, against the scratchpad's mock instance. The 12 states listed in Task 9 (L4-4) showed **no violation at all**, and there was **no CSP violation**. Before the contrast fixes, it flagged the colors listed in Task 4, Step 6.

## File map

| File | Action | Task | Responsibility |
|---|---|---|---|
| `src/schemas/mastodon.ts` (+ test) | Modify | 1 | `InstanceSchema`, lenient |
| `src/types/mastodon.ts` | Modify | 1 | `InstanceConfiguration` |
| `src/config/constants.ts` | Modify | 1 | `DEFAULT_MAX_CHARACTERS` |
| `src/composables/useMastodonApi.ts` (+ test) | Modify | 1 | `getInstanceConfiguration()` |
| `src/stores/instance.ts` (+ test) | Create | 1 | Limits store: load, fallback, reset |
| `src/utils/media.ts` (+ test) | Modify | 1, 2 | `usableImageTypes`; pure `getImageRejection(file, limits)`, `acceptedImageFiles`, `describeImageTypes`, `formatMegabytes` |
| `src/components/MediaUpload.vue` (+ test) | Modify | 2, 3, 4 | Limits from the store; dialog name; alert; contrast |
| `src/components/ContentArea.vue` (+ test, new) | Modify | 2, 4 | `maxCharacters`; live region; labels; controlled toggles; contrast |
| `src/components/Toot/TootComposer.vue` (+ test) | Modify | 2, 4, 5 | Length check; toggle props; alert; contrast; `<h1>` |
| `src/components/Modals/ModalView.vue` (+ test, new) | Modify | 3 | Named dialog, Escape, focus in and back, `close` |
| `src/components/Modals/*.vue`, `Auth/LoginForm.vue`, `LandingPage.vue`, `App.vue` | Modify | 3 | Heading ids, `labelled-by`, `@close` |
| `src/App.vue` | Modify | 1, 3, 4, 5 | Creates the instance store; `.visually-hidden`; `<main>`; `<MobileNav>` |
| `src/components/Modals/DeleteConfirmModal.vue`, `ThanksConfirmModal.vue`, `ControlsBar.vue` | Modify | 4 | Contrast |
| `.claude/skills/ui-design-system/SKILL.md` | Modify | 4 | Corrected semantic colors |
| `src/components/MobileNav.vue` (+ test) | Create | 5 | Accessible burger menu |
| `src/App.test.ts`, `src/components/LandingPage.test.ts` | Create | 5 | One `<main>`, one `<h1>` |
| `src/components/LandingPage.vue`, `OAuthCallback.vue`, `Toot/ScheduledToots.vue` | Modify | 5 | Headings and landmarks |
| `src/stores/scheduledToots.ts` (+ test) | Modify | 6 | `pendingId`, `pendingAction`, `deleteToot` |
| `src/components/Toot/TootCard.vue` (+ test, new) | Modify | 6, 7 | Unique ids, emits, progress per card; time zone |
| `src/components/Toot/ScheduledToots.vue` (+ test, new) | Modify | 3, 4, 5, 6 | Delete through the store, focus, list kept while refreshing |
| `src/utils/timeZone.ts` (+ test) | Create | 7 | `getTimeZone()` |
| `src/components/ControlsBar.vue` (+ test) | Modify | 4, 7 | Contrast; time zone hint |
| `package.json`, `package-lock.json`, `src/stores/features.ts`, `README.md` | Modify | 8 | Release 0.16.0 |

Test count after each task: 196 → **209** (T1) → **219** (T2) → **226** (T3) → **229** (T4) → **236** (T5) → **246** (T6) → **250** (T7) → 250 (T8) → **362** after the final-review and Safari/VoiceOver fixes. Each task leaves typecheck, lint and tests green.

---

### Task 1: Read the instance limits: schema, API call and `instance` store (BUG-08)

**Goal:** After every sign-in or restored session, the app reads `GET /api/v2/instance` and keeps four limits in a new `instance` setup store. It falls back to the current defaults per field, when the request fails, on sign-out and on an account switch. Nothing uses the limits yet; Task 2 wires them.

**Files:**
- Modify: `src/schemas/mastodon.ts` (`InstanceSchema`)
- Test: `src/schemas/mastodon.test.ts`
- Modify: `src/types/mastodon.ts` (`InstanceConfiguration`)
- Modify: `src/config/constants.ts` (`DEFAULT_MAX_CHARACTERS`)
- Modify: `src/composables/useMastodonApi.ts` (`getInstanceConfiguration`)
- Test: `src/composables/useMastodonApi.test.ts`
- Modify: `src/utils/media.ts` (`usableImageTypes`)
- Test: `src/utils/media.test.ts`
- Create: `src/stores/instance.ts`
- Test: `src/stores/instance.test.ts`
- Modify: `src/App.vue` (2 lines: the store is created on every page)

**Acceptance Criteria:**
- [ ] `InstanceSchema` maps `configuration.statuses.max_characters` and `.max_media_attachments`, and `configuration.media_attachments.image_size_limit` and `.supported_mime_types`, to `maxCharacters`, `maxMediaAttachments`, `imageSizeLimit` and `supportedMimeTypes`. A missing or invalid value (not a positive integer, wrong type, `configuration` not an object) becomes `undefined` instead of refusing the response. Only a body that is not an object is refused
- [ ] `getInstanceConfiguration()` sends `GET ${instance}/api/v2/instance` through the shared client and validates it with `parseApiResponse`. Errors are rethrown with `cause`
- [ ] `usableImageTypes(list)` keeps the instance types that are in Lot 3's `SUPPORTED_IMAGE_TYPES` (case-insensitive, in the app's order). With no list, or no usable type in it, it returns the full default list
- [ ] `useInstanceStore` exposes `maxCharacters` (default 500), `maxMediaAttachments` (4), `imageSizeLimit` (8 MB) and `supportedMimeTypes` (Lot 3 list, images only). It:
  - loads after sign-in and after a restored session;
  - keeps the default of each missing field, and all defaults when the request fails;
  - goes back to the defaults on sign-out and on an account switch, then reloads for the new account;
  - ignores an answer that arrives after the session changed
- [ ] `App.vue` creates the store, so it runs on every page
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 209 tests

**Verify:** `npx vitest run src/schemas/mastodon.test.ts src/composables/useMastodonApi.test.ts src/utils/media.test.ts src/stores/instance.test.ts` → `Tests  51 passed (51)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. In `src/schemas/mastodon.test.ts`, add `InstanceSchema` to the import list, right after `AppRegistrationSchema,`:

```ts
  InstanceSchema,
```

Then add these two tests at the end of the `describe('mastodon schemas', ...)` block, before its closing `});`:

```ts
  it('reads the instance limits the composer needs', () => {
    const instance = {
      domain: 'masto.example',
      configuration: {
        statuses: { max_characters: 1000, max_media_attachments: 6, characters_reserved_per_url: 23 },
        media_attachments: { supported_mime_types: ['image/png', 'video/mp4'], image_size_limit: 16777216 },
      },
    };
    expect(InstanceSchema.parse(instance)).toEqual({
      maxCharacters: 1000,
      maxMediaAttachments: 6,
      imageSizeLimit: 16777216,
      supportedMimeTypes: ['image/png', 'video/mp4'],
    });
  });

  it('drops missing or invalid instance limits instead of refusing the response', () => {
    const parsed = InstanceSchema.parse({
      configuration: {
        statuses: { max_characters: -1, max_media_attachments: 2.5 },
        media_attachments: { supported_mime_types: 'image/png', image_size_limit: '8MB' },
      },
    });
    expect(parsed).toEqual({ maxCharacters: undefined, maxMediaAttachments: undefined, imageSizeLimit: undefined, supportedMimeTypes: undefined });
    expect(InstanceSchema.parse({ configuration: 'none' }).maxCharacters).toBeUndefined();
    expect(InstanceSchema.parse({}).maxCharacters).toBeUndefined();
    expect(InstanceSchema.safeParse('<html>').success).toBe(false);
  });
```

2. In `src/composables/useMastodonApi.test.ts`, insert this block right before `  describe('deleteScheduledToot', () => {`:

```ts
  describe('getInstanceConfiguration', () => {
    it('reads the limits from the v2 instance endpoint', async () => {
      http.get.mockResolvedValue({ data: { configuration: { statuses: { max_characters: 1000 } } } });

      const configuration = await useMastodonApi().getInstanceConfiguration();

      expect(http.get).toHaveBeenCalledWith('https://masto.example/api/v2/instance');
      expect(configuration.maxCharacters).toBe(1000);
      expect(configuration.supportedMimeTypes).toBeUndefined();
    });

    it('fails when the instance cannot be read', async () => {
      http.get.mockRejectedValue(new Error('Request failed with status code 404'));

      await expect(useMastodonApi().getInstanceConfiguration()).rejects.toThrow('Request failed with status code 404');
    });
  });

```

3. In `src/utils/media.test.ts`, replace `import { getImageRejection, MAX_IMAGE_BYTES } from './media';` with:

```ts
import { getImageRejection, MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES, usableImageTypes } from './media';
```

Then add at the end of the file:

```ts

describe('usableImageTypes', () => {
  it('keeps the instance image types the app supports, in the app order', () => {
    expect(usableImageTypes(['video/mp4', 'image/webp', 'IMAGE/PNG', 'image/svg+xml', 'image/bmp'])).toEqual(['image/png', 'image/webp']);
  });

  it('falls back to the app list without a usable instance list', () => {
    expect(usableImageTypes(undefined)).toEqual(SUPPORTED_IMAGE_TYPES);
    expect(usableImageTypes(['video/mp4', 'audio/mpeg'])).toEqual(SUPPORTED_IMAGE_TYPES);
  });
});
```

4. Create `src/stores/instance.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const api = vi.hoisted(() => ({ getInstanceConfiguration: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn().mockResolvedValue({}), isAxiosError: () => false } }));

import { useInstanceStore } from './instance';
import { useAuthStore } from './auth';
import { SUPPORTED_IMAGE_TYPES } from '../utils/media';

const credentials = { instance: 'https://masto.example', clientId: 'id', clientSecret: 'secret', accessToken: 'token-a' };

const DEFAULTS = {
  maxCharacters: 500,
  maxMediaAttachments: 4,
  imageSizeLimit: 8 * 1024 * 1024,
  supportedMimeTypes: SUPPORTED_IMAGE_TYPES,
};

function limitsOf(store: ReturnType<typeof useInstanceStore>) {
  return {
    maxCharacters: store.maxCharacters,
    maxMediaAttachments: store.maxMediaAttachments,
    imageSizeLimit: store.imageSizeLimit,
    supportedMimeTypes: store.supportedMimeTypes,
  };
}

describe('instance store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    setActivePinia(createPinia());
    api.getInstanceConfiguration.mockResolvedValue({
      maxCharacters: 1000,
      maxMediaAttachments: 2,
      imageSizeLimit: 16 * 1024 * 1024,
      supportedMimeTypes: ['image/png', 'video/mp4'],
    });
  });

  it('uses the defaults and asks nothing before sign-in', () => {
    const store = useInstanceStore();

    expect(limitsOf(store)).toEqual(DEFAULTS);
    expect(api.getInstanceConfiguration).not.toHaveBeenCalled();
  });

  it('reads the limits after sign-in, keeping only image types', async () => {
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(limitsOf(store)).toEqual({
      maxCharacters: 1000,
      maxMediaAttachments: 2,
      imageSizeLimit: 16 * 1024 * 1024,
      supportedMimeTypes: ['image/png'],
    });
  });

  it('reads the limits of a restored session', async () => {
    localStorage.setItem('mastodon_auth', JSON.stringify({ ...credentials, lastActivityAt: Date.now() }));
    const store = useInstanceStore();
    await flushPromises();

    expect(api.getInstanceConfiguration).toHaveBeenCalledTimes(1);
    expect(store.maxCharacters).toBe(1000);
  });

  it('falls back to the defaults when the instance cannot be read', async () => {
    api.getInstanceConfiguration.mockRejectedValue(new Error('Request failed with status code 404'));
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(limitsOf(store)).toEqual(DEFAULTS);
  });

  it('keeps the default of each limit the instance did not give', async () => {
    api.getInstanceConfiguration.mockResolvedValue({ maxCharacters: 1000 });
    const store = useInstanceStore();
    useAuthStore().completeLogin(credentials);
    await flushPromises();

    expect(limitsOf(store)).toEqual({ ...DEFAULTS, maxCharacters: 1000 });
  });

  it('goes back to the defaults on sign-out and reads them again for the next account', async () => {
    const store = useInstanceStore();
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    await flushPromises();

    await auth.logout();
    await flushPromises();
    expect(limitsOf(store)).toEqual(DEFAULTS);

    api.getInstanceConfiguration.mockResolvedValue({ maxCharacters: 5000 });
    auth.completeLogin({ ...credentials, accessToken: 'token-b' });
    await flushPromises();
    expect(store.maxCharacters).toBe(5000);
  });

  it('ignores limits that arrive after the session changed', async () => {
    let answer!: (value: unknown) => void;
    api.getInstanceConfiguration.mockReturnValue(new Promise(resolve => { answer = resolve; }));
    const store = useInstanceStore();
    const auth = useAuthStore();
    auth.completeLogin(credentials);
    await flushPromises();

    await auth.logout();
    answer({ maxCharacters: 1000 });
    await flushPromises();

    expect(store.maxCharacters).toBe(500);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/schemas/mastodon.test.ts src/composables/useMastodonApi.test.ts src/utils/media.test.ts src/stores/instance.test.ts`

Expected: FAIL.
- `instance.test.ts` cannot resolve `./instance`.
- The 2 schema tests fail on `InstanceSchema` being undefined.
- The 2 `getInstanceConfiguration` tests fail with `getInstanceConfiguration is not a function`.
- The 2 `usableImageTypes` tests fail with `usableImageTypes is not a function`.
- Everything else passes.

- [ ] **Step 3: Write the implementation**

1. `src/schemas/mastodon.ts`: insert this right before `/** POST /api/v1/apps */`:

```ts
/** A limit from the instance: a positive whole number, or dropped (undefined) so the app's default applies. */
const optionalLimit = z.number().int().positive().optional().catch(undefined);

/**
 * GET /api/v2/instance, reduced to the limits the composer follows. Every part is optional:
 * a missing or invalid value is dropped and the app keeps its default for it, so an unusual
 * instance never blocks the composer. Only a body that is not an object is refused.
 */
export const InstanceSchema = z.object({
  configuration: z.object({
    statuses: z.object({
      max_characters: optionalLimit,
      max_media_attachments: optionalLimit,
    }).optional().catch(undefined),
    media_attachments: z.object({
      image_size_limit: optionalLimit,
      supported_mime_types: z.array(z.string()).optional().catch(undefined),
    }).optional().catch(undefined),
  }).optional().catch(undefined),
}).transform(instance => ({
  maxCharacters: instance.configuration?.statuses?.max_characters,
  maxMediaAttachments: instance.configuration?.statuses?.max_media_attachments,
  imageSizeLimit: instance.configuration?.media_attachments?.image_size_limit,
  supportedMimeTypes: instance.configuration?.media_attachments?.supported_mime_types,
}));

```

2. `src/types/mastodon.ts`: add at the end of the file, after the `ScheduledToot` interface:

```ts

/** The limits an instance reports (GET /api/v2/instance). A missing value: the instance gave none, or an invalid one. */
export interface InstanceConfiguration {
  maxCharacters?: number;
  maxMediaAttachments?: number;
  /** Bytes. */
  imageSizeLimit?: number;
  /** Every MIME type the instance accepts, images or not. */
  supportedMimeTypes?: string[];
}
```

3. `src/config/constants.ts`: add at the end:

```ts

/** Mastodon's default toot length, used until (or unless) the instance reports its own. */
export const DEFAULT_MAX_CHARACTERS = 500;
```

4. `src/composables/useMastodonApi.ts`:
   - Replace `import type { MastodonAccount, MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';` with:

```ts
import type { InstanceConfiguration, MastodonAccount, MastodonStatus, ScheduledToot, MastodonMediaAttachment } from '../types/mastodon';
```

   - In the `../schemas/mastodon` import list, add `  InstanceSchema,` right after `  AppRegistrationSchema,`.
   - Insert this function right before the JSDoc of `scheduleToot` (`  /**` followed by `   * Schedules a toot to be posted at a later time.`):

```ts
  /**
   * Reads the limits of the signed-in instance (GET /api/v2/instance, Mastodon 4.0+).
   * The endpoint is public; the shared client still sends the token only to this instance.
   * @returns {Promise<InstanceConfiguration>} The limits it reported; missing or invalid ones are left out.
   * @throws {Error} If the instance URL is not set, the request fails or the body is not an object.
   */
  async function getInstanceConfiguration(): Promise<InstanceConfiguration> {
    if (!auth.instance) throw new Error('No instance URL set');
    try {
      const response = await api.get(`${auth.instance}/api/v2/instance`);
      return parseApiResponse(InstanceSchema, response.data, 'instance information');
    } catch (error) {
      throw new Error(handleApiError(error), { cause: error });
    }
  }

```

   - In the returned object, right after `    verifyCredentials,`, add:

```ts

    /**
     * Reads the limits of the signed-in instance.
     * @returns {Promise<InstanceConfiguration>} The limits it reported.
     */
    getInstanceConfiguration,
```

5. `src/utils/media.ts`: insert this right before `/** The file's type, guessed from its extension`:

```ts
/**
 * The image types this app can attach on an instance: the instance's own list, kept to the
 * images the app supports. Without a usable list (none sent, or no supported image in it)
 * the app's default list applies; the instance still checks every upload.
 * @param {readonly string[] | undefined} instanceTypes - `supported_mime_types` from the instance.
 * @returns {string[]} The image MIME types to accept.
 */
export function usableImageTypes(instanceTypes: readonly string[] | undefined): string[] {
  if (!instanceTypes) return [...SUPPORTED_IMAGE_TYPES];
  const offered = new Set(instanceTypes.map(type => type.toLowerCase()));
  const usable = SUPPORTED_IMAGE_TYPES.filter(type => offered.has(type));
  return usable.length > 0 ? usable : [...SUPPORTED_IMAGE_TYPES];
}

```

6. Create `src/stores/instance.ts`:

```ts
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAuthStore } from './auth';
import { useMastodonApi } from '../composables/useMastodonApi';
import { DEFAULT_MAX_CHARACTERS } from '../config/constants';
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_TOOT, SUPPORTED_IMAGE_TYPES, usableImageTypes } from '../utils/media';

/**
 * Creates a Pinia store for the signed-in instance's limits (toot length, images per toot,
 * image size and types). It reads them after every sign-in or restored session and goes back
 * to Mastodon's defaults on sign-out, on an account switch, or when the instance can't tell.
 * @returns {Object} The instance store with its limits.
 */
export const useInstanceStore = defineStore('instance', () => {
  const auth = useAuthStore();

  const maxCharacters = ref(DEFAULT_MAX_CHARACTERS);
  const maxMediaAttachments = ref(MAX_IMAGES_PER_TOOT);
  const imageSizeLimit = ref(MAX_IMAGE_BYTES);
  const supportedMimeTypes = ref<string[]>([...SUPPORTED_IMAGE_TYPES]);

  function reset(): void {
    maxCharacters.value = DEFAULT_MAX_CHARACTERS;
    maxMediaAttachments.value = MAX_IMAGES_PER_TOOT;
    imageSizeLimit.value = MAX_IMAGE_BYTES;
    supportedMimeTypes.value = [...SUPPORTED_IMAGE_TYPES];
  }

  /**
   * Reads the current instance's limits. Each missing or invalid one keeps its default, and a
   * failed request keeps them all: the instance stays the final judge of every toot.
   */
  async function load(): Promise<void> {
    // Limits read for a previous session must not apply to the current one.
    const token = auth.accessToken;
    if (!token) return;
    try {
      const configuration = await useMastodonApi().getInstanceConfiguration();
      if (auth.accessToken !== token) return;
      maxCharacters.value = configuration.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
      maxMediaAttachments.value = configuration.maxMediaAttachments ?? MAX_IMAGES_PER_TOOT;
      imageSizeLimit.value = configuration.imageSizeLimit ?? MAX_IMAGE_BYTES;
      supportedMimeTypes.value = usableImageTypes(configuration.supportedMimeTypes);
    } catch (error) {
      console.error('Could not read the instance limits, using the defaults:', error);
    }
  }

  // Sign-in, restored session, account switch in another tab, sign-out: always start from the defaults.
  watch(() => auth.accessToken, (token, previous) => {
    if (token === previous) return;
    reset();
    if (token) void load();
  }, { immediate: true });

  return {
    /** Longest toot the instance accepts, in characters. */
    maxCharacters,
    /** Most images per toot. */
    maxMediaAttachments,
    /** Largest image, in bytes. */
    imageSizeLimit,
    /** Image MIME types the app can attach on this instance (images only, never empty). */
    supportedMimeTypes,
    /** Reads the limits again for the current session. */
    load,
  };
});
```

7. `src/App.vue`:
   - right after `import { useFeaturesStore } from './stores/features';`, add `import { useInstanceStore } from './stores/instance';`;
   - right after `useSessionTimeout();`, add:

```ts

// Reads the instance's limits after every sign-in or restored session.
useInstanceStore();
```

- [ ] **Step 4: Verify**

```bash
npx vitest run src/schemas/mastodon.test.ts src/composables/useMastodonApi.test.ts src/utils/media.test.ts src/stores/instance.test.ts
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected:
- `Tests  51 passed (51)`;
- `exit=0`;
- `0 errors` (the 4 existing warnings remain);
- `Tests  209 passed (209)`.

The store tests print a `Could not read the instance limits` line on stderr. That is the expected fallback log.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/mastodon.ts src/schemas/mastodon.test.ts src/types/mastodon.ts src/config/constants.ts src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts src/utils/media.ts src/utils/media.test.ts src/stores/instance.ts src/stores/instance.test.ts src/App.vue
git commit -m "feat(instance): read the instance limits from /api/v2/instance, with defaults as fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/schemas/mastodon.ts", "src/schemas/mastodon.test.ts", "src/types/mastodon.ts", "src/config/constants.ts", "src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts", "src/utils/media.ts", "src/utils/media.test.ts", "src/stores/instance.ts", "src/stores/instance.test.ts", "src/App.vue"], "verifyCommand": "npx vitest run src/schemas/mastodon.test.ts src/composables/useMastodonApi.test.ts src/utils/media.test.ts src/stores/instance.test.ts", "acceptanceCriteria": ["lenient InstanceSchema, only non-object body refused", "getInstanceConfiguration through the shared client", "usableImageTypes intersects with the app list, falls back", "store loads on sign-in/restore, falls back per field and on failure, resets on sign-out/switch, ignores stale answers", "App creates the store", "209 tests"], "requiresUserVerification": false}
```

---

### Task 2: Apply the instance limits to the composer and to uploads (BUG-08)

**Goal:** The text box, the counter, the composer check and the image upload (count, size, types, file picker filter and hint) follow the `instance` store. `getImageRejection` becomes a pure function of the file and the limits.

**Files:**
- Modify: `src/utils/media.ts` (whole file)
- Test: `src/utils/media.test.ts` (whole file)
- Modify: `src/components/MediaUpload.vue`
- Test: `src/components/MediaUpload.test.ts` (whole file)
- Modify: `src/components/ContentArea.vue`
- Create: `src/components/ContentArea.test.ts`
- Modify: `src/components/Toot/TootComposer.vue`
- Test: `src/components/Toot/TootComposer.test.ts` (one new test)

**Acceptance Criteria:**
- [ ] `getImageRejection(file, limits)` is pure. `limits` is `{ imageTypes, maxImageBytes }`, and its messages name the accepted types and the size limit. The Lot 3 extension guess for an empty or `application/octet-stream` type is kept, and the Lot 3 tests still pass, called with `DEFAULT_IMAGE_LIMITS`
- [ ] `acceptedImageFiles(types)` builds `accept` from the types plus their extensions. With the defaults it equals Lot 3's `ACCEPTED_IMAGE_FILES`, which is removed
- [ ] `MediaUpload` takes the count, size, types, `accept` and hint from the store:
  - by default the hint is `Up to 4 images, max 8 MB each (JPEG, PNG, GIF, WebP, AVIF or HEIC)`;
  - with 2 images, 2 MB and PNG only, it is `Up to 2 images, max 2 MB each (PNG)` and `accept` is `image/png,.png`;
  - a JPEG, a third image or a 3 MB PNG are then refused before any upload
- [ ] `ContentArea`: `maxlength` and the counter use `maxCharacters` (500 by default, 1000 when the store says so)
- [ ] The composer refuses a text longer than `maxCharacters` before any request: `Your toot is 12 characters long, but your instance allows 10.`
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 219 tests

**Verify:** `npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts src/components/ContentArea.test.ts src/components/Toot/TootComposer.test.ts` → `Tests  31 passed (31)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Replace the whole of `src/utils/media.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import {
  acceptedImageFiles,
  DEFAULT_IMAGE_LIMITS,
  describeImageTypes,
  formatMegabytes,
  getImageRejection,
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_TYPES,
  usableImageTypes,
} from './media';

function file(name: string, type: string, size = 10): File {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
}

describe('getImageRejection', () => {
  it('accepts the image types Mastodon supports', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic']) {
      expect(getImageRejection(file('a', type), DEFAULT_IMAGE_LIMITS)).toBeNull();
    }
  });

  it('refuses other types, including SVG and a missing type', () => {
    expect(getImageRejection(file('doc.pdf', 'application/pdf'), DEFAULT_IMAGE_LIMITS)).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
    expect(getImageRejection(file('logo.svg', 'image/svg+xml'), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
    expect(getImageRejection(file('noext', ''), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('refuses an image over 8 MB', () => {
    expect(getImageRejection(file('big.png', 'image/png', MAX_IMAGE_BYTES + 1), DEFAULT_IMAGE_LIMITS)).toBe('"big.png" is larger than 8 MB.');
    expect(getImageRejection(file('max.png', 'image/png', MAX_IMAGE_BYTES), DEFAULT_IMAGE_LIMITS)).toBeNull();
  });

  it('also guesses the type when the browser reports a generic binary type', () => {
    expect(getImageRejection(file('photo.heic', 'application/octet-stream'), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('archive.zip', 'application/octet-stream'), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('guesses the type from the extension when the browser reports none', () => {
    expect(getImageRejection(file('photo.HEIC', ''), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('photo.avif', ''), DEFAULT_IMAGE_LIMITS)).toBeNull();
    expect(getImageRejection(file('notes.txt', ''), DEFAULT_IMAGE_LIMITS)).not.toBeNull();
  });

  it('applies the limits it is given', () => {
    const pngUpTo2MB = { imageTypes: ['image/png'], maxImageBytes: 2 * 1024 * 1024 };
    expect(getImageRejection(file('photo.jpg', 'image/jpeg'), pngUpTo2MB)).toBe('"photo.jpg" is not a supported image (PNG).');
    expect(getImageRejection(file('photo.png', '', 3 * 1024 * 1024), pngUpTo2MB)).toBe('"photo.png" is larger than 2 MB.');
    expect(getImageRejection(file('photo.png', 'image/png', 9 * 1024 * 1024), { ...DEFAULT_IMAGE_LIMITS, maxImageBytes: 16 * 1024 * 1024 })).toBeNull();
  });
});

describe('usableImageTypes', () => {
  it('keeps the instance image types the app supports, in the app order', () => {
    expect(usableImageTypes(['video/mp4', 'image/webp', 'IMAGE/PNG', 'image/svg+xml', 'image/bmp'])).toEqual(['image/png', 'image/webp']);
  });

  it('falls back to the app list without a usable instance list', () => {
    expect(usableImageTypes(undefined)).toEqual(SUPPORTED_IMAGE_TYPES);
    expect(usableImageTypes(['video/mp4', 'audio/mpeg'])).toEqual(SUPPORTED_IMAGE_TYPES);
  });
});

describe('describing the limits', () => {
  it('builds the file picker filter from the accepted types', () => {
    expect(acceptedImageFiles(['image/png'])).toBe('image/png,.png');
    expect(acceptedImageFiles(SUPPORTED_IMAGE_TYPES)).toBe(`${SUPPORTED_IMAGE_TYPES.join(',')},.jpg,.jpeg,.png,.gif,.webp,.avif,.heic,.heif`);
  });

  it('names the accepted types', () => {
    expect(describeImageTypes(SUPPORTED_IMAGE_TYPES)).toBe('JPEG, PNG, GIF, WebP, AVIF or HEIC');
    expect(describeImageTypes(['image/png', 'image/gif'])).toBe('PNG or GIF');
    expect(describeImageTypes(['image/png'])).toBe('PNG');
  });

  it('rounds sizes down to one decimal', () => {
    expect(formatMegabytes(8 * 1024 * 1024)).toBe('8');
    expect(formatMegabytes(16777216)).toBe('16');
    expect(formatMegabytes(2.56 * 1024 * 1024)).toBe('2.5');
  });
});
```

2. Replace the whole of `src/components/MediaUpload.test.ts` with the version below. Every mount now goes through `mountUpload`, with Pinia, and there are 3 new tests at the end:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonMediaAttachment } from '../types/mastodon';

const api = vi.hoisted(() => ({ uploadMedia: vi.fn(), updateMediaMetadata: vi.fn() }));
vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import MediaUpload from './MediaUpload.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountUpload(modelValue: MastodonMediaAttachment[] = []) {
  return mount(MediaUpload, { props: { modelValue }, global: { plugins: [pinia] } });
}

/** An instance that accepts 2 PNG images of up to 2 MB per toot. */
function useSmallInstance(): void {
  const instance = useInstanceStore();
  instance.maxMediaAttachments = 2;
  instance.imageSizeLimit = 2 * 1024 * 1024;
  instance.supportedMimeTypes = ['image/png'];
}

function media(id: string): MastodonMediaAttachment {
  return { id, type: 'image', url: `https://masto.example/${id}.png`, preview_url: `https://masto.example/${id}.png` };
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.find('.upload-area').trigger('drop', { dataTransfer: { files } });
}

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it('shows a placeholder instead of a broken image when there is no preview yet', () => {
    const wrapper = mountUpload([{ id: 'v1', type: 'video', url: null }]);
    expect(wrapper.find('.media-preview img').exists()).toBe(false);
    expect(wrapper.find('.preview-placeholder').text()).toBe('Processing…');
  });

  it('refuses a dropped file that is not a supported image, without uploading it', async () => {
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"doc.pdf" is not a supported image (JPEG, PNG, GIF, WebP, AVIF or HEIC).');
  });

  it('keeps every image when several are uploaded at once', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockResolvedValueOnce(media('m2'));
    const wrapper = mountUpload();

    await drop(wrapper, [
      new File(['a'], 'same.png', { type: 'image/png' }),
      new File(['b'], 'same.png', { type: 'image/png' }),
    ]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1', 'm2']);
  });

  it('refuses more than 4 images', async () => {
    const wrapper = mountUpload([media('a'), media('b'), media('c')]);

    await drop(wrapper, [new File(['a'], '1.png', { type: 'image/png' }), new File(['b'], '2.png', { type: 'image/png' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Maximum 4 images allowed');
  });

  it('ignores a second drop while an upload is running', async () => {
    api.uploadMedia.mockReturnValue(new Promise(() => {}));
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'a.png', { type: 'image/png' })]);
    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' })]);

    expect(api.uploadMedia).toHaveBeenCalledTimes(1);
  });

  it('locks removing and describing images while an upload is running', async () => {
    api.uploadMedia.mockReturnValue(new Promise(() => {}));
    const wrapper = mountUpload([media('a')]);

    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' })]);

    expect(wrapper.find('.remove-button').attributes('disabled')).toBeDefined();
    expect(wrapper.find('.edit-alt-button').attributes('disabled')).toBeDefined();
  });

  it('keeps the images already uploaded and names the file that failed', async () => {
    api.uploadMedia.mockResolvedValueOnce(media('m1')).mockRejectedValueOnce(new Error('File too large'));
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })]);
    await flushPromises();

    const events = wrapper.emitted('update:modelValue') as MastodonMediaAttachment[][][];
    expect(events.at(-1)?.[0].map(item => item.id)).toEqual(['m1']);
    expect(wrapper.find('.error').text()).toBe('Could not upload "b.png": File too large');
  });

  it("describes the instance's limits and filters the file picker with them", async () => {
    const wrapper = mountUpload();
    expect(wrapper.find('.upload-hint').text()).toBe('Up to 4 images, max 8 MB each (JPEG, PNG, GIF, WebP, AVIF or HEIC)');

    useSmallInstance();
    await flushPromises();

    expect(wrapper.find('.upload-hint').text()).toBe('Up to 2 images, max 2 MB each (PNG)');
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe('image/png,.png');
  });

  it('refuses a type the instance does not accept, without uploading it', async () => {
    useSmallInstance();
    const wrapper = mountUpload();

    await drop(wrapper, [new File(['a'], 'photo.jpg', { type: 'image/jpeg' })]);
    await flushPromises();

    expect(api.uploadMedia).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('"photo.jpg" is not a supported image (PNG).');
  });

  it('refuses more images, or larger ones, than the instance allows', async () => {
    useSmallInstance();
    const wrapper = mountUpload([media('a')]);

    await drop(wrapper, [new File(['b'], 'b.png', { type: 'image/png' }), new File(['c'], 'c.png', { type: 'image/png' })]);
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Maximum 2 images allowed');

    const big = new File(['d'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });
    await drop(wrapper, [big]);
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('"big.png" is larger than 2 MB.');

    expect(api.uploadMedia).not.toHaveBeenCalled();
  });
});
```

3. Create `src/components/ContentArea.test.ts`. The counter is matched with `/^495\b/`, so the screen-reader text added in Task 4 doesn't break it:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import ContentArea from './ContentArea.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountArea(modelValue = 'Hello') {
  return mount(ContentArea, {
    props: { modelValue, hasPoll: false, hasMedia: false },
    global: { plugins: [pinia] },
  });
}

describe('ContentArea', () => {
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("uses Mastodon's default limit until the instance answers", () => {
    const wrapper = mountArea();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('500');
    expect(wrapper.find('.character-count').text()).toMatch(/^495\b/);
  });

  it("follows the instance's character limit", async () => {
    const wrapper = mountArea();
    useInstanceStore().maxCharacters = 1000;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('1000');
    expect(wrapper.find('.character-count').text()).toMatch(/^995\b/);
  });
});
```

4. In `src/components/Toot/TootComposer.test.ts`:
   - right after `import { useScheduledTootsStore } from '../../stores/scheduledToots';`, add `import { useInstanceStore } from '../../stores/instance';`;
   - insert this test right before `  it('does not send a poll that was opened, filled in and closed again', async () => {`:

```ts
  it('refuses a toot longer than the instance allows, without sending it', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    useInstanceStore().maxCharacters = 10;
    await fillForm(wrapper, 'Hello world!');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.scheduleToot).not.toHaveBeenCalled();
    expect(wrapper.find('.error').text()).toBe('Your toot is 12 characters long, but your instance allows 10.');
  });

```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts src/components/ContentArea.test.ts src/components/Toot/TootComposer.test.ts`

Expected: FAIL.
- `media.test.ts`: `acceptedImageFiles`, `describeImageTypes`, `formatMegabytes` and `DEFAULT_IMAGE_LIMITS` do not exist yet.
- `MediaUpload.test.ts`: the 3 new tests fail (the hint and limits are still hard-coded).
- `ContentArea.test.ts`: `follows the instance's character limit` fails (`maxlength` stays `500`).
- `TootComposer.test.ts`: the new test fails (`scheduleToot` is called).

- [ ] **Step 3: Write the implementation**

1. Replace the whole of `src/utils/media.ts` with:

```ts
/** Image types Mastodon accepts that this app lets users attach (used when the instance gives no list). */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit, used when the instance gives none. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon's default number of media attachments per toot, used when the instance gives none. */
export const MAX_IMAGES_PER_TOOT = 4;

/** What an image is checked against before upload: the instance's limits, or the defaults above. */
export interface ImageLimits {
  /** Accepted image MIME types. */
  imageTypes: readonly string[];
  /** Largest accepted image, in bytes. */
  maxImageBytes: number;
}

/** The limits used until the instance gives its own. */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = { imageTypes: SUPPORTED_IMAGE_TYPES, maxImageBytes: MAX_IMAGE_BYTES };

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', heic: 'image/heic', heif: 'image/heif',
};

/** Names shown to the user; HEIF is presented as HEIC, the name people know. */
const TYPE_NAMES: Record<string, string> = {
  'image/jpeg': 'JPEG', 'image/png': 'PNG', 'image/gif': 'GIF', 'image/webp': 'WebP',
  'image/avif': 'AVIF', 'image/heic': 'HEIC', 'image/heif': 'HEIC',
};

/**
 * The image types this app can attach on an instance: the instance's own list, kept to the
 * images the app supports. Without a usable list (none sent, or no supported image in it)
 * the app's default list applies; the instance still checks every upload.
 * @param {readonly string[] | undefined} instanceTypes - `supported_mime_types` from the instance.
 * @returns {string[]} The image MIME types to accept.
 */
export function usableImageTypes(instanceTypes: readonly string[] | undefined): string[] {
  if (!instanceTypes) return [...SUPPORTED_IMAGE_TYPES];
  const offered = new Set(instanceTypes.map(type => type.toLowerCase()));
  const usable = SUPPORTED_IMAGE_TYPES.filter(type => offered.has(type));
  return usable.length > 0 ? usable : [...SUPPORTED_IMAGE_TYPES];
}

/**
 * The file picker's `accept` value: the MIME types plus their extensions, so systems that
 * don't know HEIC or AVIF still offer those files.
 * @param {readonly string[]} imageTypes - The accepted image MIME types.
 * @returns {string} e.g. "image/png,.png".
 */
export function acceptedImageFiles(imageTypes: readonly string[]): string {
  const extensions = Object.entries(EXTENSION_TYPES)
    .filter(([, type]) => imageTypes.includes(type))
    .map(([extension]) => `.${extension}`);
  return [...imageTypes, ...extensions].join(',');
}

/**
 * Names the accepted image types for the user.
 * @param {readonly string[]} imageTypes - The accepted image MIME types.
 * @returns {string} e.g. "JPEG, PNG or GIF".
 */
export function describeImageTypes(imageTypes: readonly string[]): string {
  const names = [...new Set(imageTypes.map(type => TYPE_NAMES[type] ?? type))];
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * A size in megabytes, rounded down to one decimal so a limit is never overstated.
 * @param {number} bytes - The size in bytes.
 * @returns {string} e.g. "8", "16" or "2.5".
 */
export function formatMegabytes(bytes: number): string {
  return String(Math.floor((bytes / (1024 * 1024)) * 10) / 10);
}

/** The file's type, guessed from its extension when the browser doesn't know it (empty or generic binary type). */
function imageType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const dot = file.name.lastIndexOf('.');
  return dot === -1 ? '' : EXTENSION_TYPES[file.name.slice(dot + 1).toLowerCase()] ?? '';
}

/**
 * Explains why a file can't be attached, or returns null when it can. Checked before
 * uploading, including for drag and drop where the file picker's `accept` doesn't apply;
 * the instance stays the final authority.
 * @param {File} file - The file to check.
 * @param {ImageLimits} limits - The accepted types and largest size.
 * @returns {string | null} A message for the user, or null.
 */
export function getImageRejection(file: File, limits: ImageLimits): string | null {
  if (!limits.imageTypes.includes(imageType(file))) {
    return `"${file.name}" is not a supported image (${describeImageTypes(limits.imageTypes)}).`;
  }
  if (file.size > limits.maxImageBytes) {
    return `"${file.name}" is larger than ${formatMegabytes(limits.maxImageBytes)} MB.`;
  }
  return null;
}
```

2. `src/components/MediaUpload.vue`:
   - replace `import { ref } from 'vue';` with `import { computed, ref } from 'vue';`;
   - replace `import { ACCEPTED_IMAGE_FILES, getImageRejection, MAX_IMAGE_BYTES, MAX_IMAGES_PER_TOOT } from '../utils/media';` with:

```ts
import { useInstanceStore } from '../stores/instance';
import { acceptedImageFiles, describeImageTypes, formatMegabytes, getImageRejection, type ImageLimits } from '../utils/media';
```

   - right after `const api = useMastodonApi();`, add `const instance = useInstanceStore();`;
   - right after the `const uploadProgress = ...;` line, add:

```ts

/** The signed-in instance's image limits (Mastodon's defaults until it answers). */
const imageLimits = computed<ImageLimits>(() => ({
  imageTypes: instance.supportedMimeTypes,
  maxImageBytes: instance.imageSizeLimit,
}));

/** "4 images" or "1 image". */
const maxImagesLabel = computed(() => `${instance.maxMediaAttachments} ${instance.maxMediaAttachments === 1 ? 'image' : 'images'}`);

const uploadHint = computed(() =>
  `Up to ${maxImagesLabel.value}, max ${formatMegabytes(instance.imageSizeLimit)} MB each (${describeImageTypes(instance.supportedMimeTypes)})`,
);
```

   - in `uploadFiles`, replace `  const rejection = files.map(getImageRejection).find(message => message !== null);` with:

```ts
  const rejection = files.map(file => getImageRejection(file, imageLimits.value)).find(message => message !== null);
```

   - replace:

```ts
  if (props.modelValue.length + files.length > MAX_IMAGES_PER_TOOT) {
    uploadError.value = `Maximum ${MAX_IMAGES_PER_TOOT} images allowed`;
```

     with:

```ts
  if (props.modelValue.length + files.length > instance.maxMediaAttachments) {
    uploadError.value = `Maximum ${maxImagesLabel.value} allowed`;
```

   - in the template, replace `:accept="ACCEPTED_IMAGE_FILES"` with `:accept="acceptedImageFiles(instance.supportedMimeTypes)"`;
   - replace `          Up to {{ MAX_IMAGES_PER_TOOT }} images, max {{ MAX_IMAGE_BYTES / 1024 / 1024 }} MB each` with `          {{ uploadHint }}`.

3. `src/components/ContentArea.vue`:
   - right after `import { computed, ref } from 'vue';`, add `import { useInstanceStore } from '../stores/instance';`;
   - replace `const remainingCharacters = computed(() => 500 - characterCount.value);`, and the `characterCount` line above it, with:

```ts
const instance = useInstanceStore();

const characterCount = computed(() => props.modelValue.length);
/** Against the instance's own limit (Mastodon's default 500 until it answers). */
const remainingCharacters = computed(() => instance.maxCharacters - characterCount.value);
```

   - in the template, replace `:maxlength="500"` with `:maxlength="instance.maxCharacters"`.

4. `src/components/Toot/TootComposer.vue`:
   - right after `import { useAuthStore } from '../../stores/auth';`, add `import { useInstanceStore } from '../../stores/instance';`;
   - right after `const auth = useAuthStore();`, add `const instance = useInstanceStore();`;
   - in `handleSubmit`, replace:

```ts
  try {
    // Validate scheduled time
```

     with:

```ts
  try {
    // The instance would refuse it: say why before sending (e.g. an edited toot longer than the limit).
    if (content.value.length > instance.maxCharacters) {
      error.value = `Your toot is ${content.value.length} characters long, but your instance allows ${instance.maxCharacters}.`;
      return;
    }

    // Validate scheduled time
```

- [ ] **Step 4: Verify**

```bash
npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts src/components/ContentArea.test.ts src/components/Toot/TootComposer.test.ts
grep -rn "ACCEPTED_IMAGE_FILES\|MAX_IMAGES_PER_TOOT }}\|maxlength=\"500\"" src   # → no output
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected: `Tests  31 passed (31)`, no grep output, `exit=0`, `0 errors`, `Tests  219 passed (219)`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/media.ts src/utils/media.test.ts src/components/MediaUpload.vue src/components/MediaUpload.test.ts src/components/ContentArea.vue src/components/ContentArea.test.ts src/components/Toot/TootComposer.vue src/components/Toot/TootComposer.test.ts
git commit -m "feat(composer): follow the instance limits for toot length and image uploads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/media.ts", "src/utils/media.test.ts", "src/components/MediaUpload.vue", "src/components/MediaUpload.test.ts", "src/components/ContentArea.vue", "src/components/ContentArea.test.ts", "src/components/Toot/TootComposer.vue", "src/components/Toot/TootComposer.test.ts"], "verifyCommand": "npx vitest run src/utils/media.test.ts src/components/MediaUpload.test.ts src/components/ContentArea.test.ts src/components/Toot/TootComposer.test.ts", "acceptanceCriteria": ["pure getImageRejection(file, limits), Lot 3 tests kept", "accept derived from types", "MediaUpload count/size/types/accept/hint from the store", "ContentArea maxlength and counter from maxCharacters", "composer refuses over-limit text before sending", "219 tests"], "requiresUserVerification": false}
```

---

### Task 3: Accessible dialogs: named, Escape, focus in and back; one `close` event (WEB-01, BUG-09)

**Goal:** `ModalView` is named by its own heading, has a labelled close button, moves focus to the first field or action of its content and closes on Escape. It gives focus back only after a real opening. Every dialog emits a single `close` event, which removes the dead `<slot @close-child-modal>` and the `close-modal` / `close-child-modal` mismatch (BUG-09).

**Files:**
- Modify: `src/components/Modals/ModalView.vue` (script and template)
- Create: `src/components/Modals/ModalView.test.ts`
- Modify: `src/components/Modals/WhatsNew.vue`, `ThanksConfirmModal.vue`, `DeleteConfirmModal.vue` (heading ids; WhatsNew emits `close`)
- Modify: `src/components/Auth/LoginForm.vue` (heading id, emits `close`)
- Modify: `src/App.vue`, `src/components/LandingPage.vue`, `src/components/Toot/ScheduledToots.vue`, `src/components/MediaUpload.vue` (`labelled-by`, `@close`)
- Test: `src/components/Auth/LoginForm.test.ts`, `src/components/Modals/DeleteConfirmModal.test.ts`, `src/components/Modals/ThanksConfirmModal.test.ts` (one assertion each)

**Acceptance Criteria:**
- [ ] `ModalView` takes a required `labelledBy` prop, rendered as `aria-labelledby` on the dialog. The generic `aria-label="Modal dialog"` is gone, and the close button has `type="button"` and `aria-label="Close"`
- [ ] Escape, the close button and the overlay emit `close`. Escape is only listened to while the dialog is open
- [ ] When the dialog opens, focus goes to the first focusable element of its content. The close button is moved after the slot in the DOM; its position on screen is unchanged
- [ ] Focus goes back to the element that had it before opening. Nothing moves when the dialog was never opened, nor when it is unmounted after being closed
- [ ] The `<slot @close-child-modal>` listener is removed. `LoginForm` and `WhatsNew` emit `close`, and every usage listens to `@close`
- [ ] Every usage has a heading id: `whats-new-title`, `thanks-title`, `login-title`, `delete-title`, `media-edit-title`
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 226 tests

**Verify:** `npx vitest run src/components/Modals src/components/Auth/LoginForm.test.ts` → `Tests  15 passed (15)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Create `src/components/Modals/ModalView.test.ts`. Slots are render functions: string slots would need Vue's template compiler, which the tests don't load.

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { h, nextTick } from 'vue';
import ModalView from './ModalView.vue';

const mounted: VueWrapper[] = [];

/** A dialog titled "Edit" with a text field and a Save button. */
function mountModal(isOpen: boolean): VueWrapper {
  const wrapper = mount(ModalView, {
    props: { isOpen, labelledBy: 'dialog-title' },
    slots: {
      default: () => [
        h('h2', { id: 'dialog-title' }, 'Edit'),
        h('input', { id: 'first-field' }),
        h('button', { type: 'button' }, 'Save'),
      ],
    },
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

/** A button outside the dialog, focused. */
function focusedButton(): HTMLButtonElement {
  const button = document.createElement('button');
  document.body.appendChild(button);
  button.focus();
  return button;
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
}

describe('ModalView', () => {
  afterEach(() => {
    mounted.splice(0).forEach(wrapper => wrapper.unmount());
    document.body.innerHTML = '';
  });

  it('is named by its heading and has a labelled close button', () => {
    const wrapper = mountModal(true);

    expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBe('dialog-title');
    expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBeUndefined();
    expect(wrapper.find('.close-button').attributes('aria-label')).toBe('Close');
  });

  it('closes on Escape, the close button and the overlay', async () => {
    const wrapper = mountModal(true);
    await nextTick();

    pressEscape();
    await wrapper.find('.close-button').trigger('click');
    await wrapper.find('.modal-overlay').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('ignores Escape while closed', async () => {
    const wrapper = mountModal(false);
    await nextTick();

    pressEscape();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('puts focus on the first focusable element of its content when it opens', async () => {
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();

    expect(document.activeElement?.id).toBe('first-field');
  });

  it('gives focus back to what had it before opening', async () => {
    const trigger = focusedButton();
    const wrapper = mountModal(false);

    await wrapper.setProps({ isOpen: true });
    await nextTick();
    await wrapper.setProps({ isOpen: false });

    expect(document.activeElement).toBe(trigger);
  });

  it('never moves focus when it was never opened', async () => {
    focusedButton();
    const wrapper = mountModal(false);
    const elsewhere = focusedButton();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.activeElement).toBe(elsewhere);
  });

  it('does not take focus back when unmounted after it was closed', async () => {
    focusedButton();
    const wrapper = mountModal(false);
    await wrapper.setProps({ isOpen: true });
    await nextTick();
    await wrapper.setProps({ isOpen: false });
    const elsewhere = focusedButton();

    wrapper.unmount();
    mounted.splice(mounted.indexOf(wrapper), 1);

    expect(document.activeElement).toBe(elsewhere);
  });
});
```

2. `src/components/Auth/LoginForm.test.ts`: in the first test, right after the `code_challenge` assertion (`expect(url.searchParams.get('code_challenge'))...`), add:

```ts
    expect(wrapper.emitted('close')).toHaveLength(1);
```

3. `src/components/Modals/DeleteConfirmModal.test.ts`: in `renders the toot preview as text`, after `expect(wrapper.find('.toot-preview b').exists()).toBe(false);`, add:

```ts
    expect(wrapper.find('#delete-title').text()).toBe('Delete scheduled toot?');
```

4. `src/components/Modals/ThanksConfirmModal.test.ts`: in `shows the exact message as text`, after `expect(wrapper.find('.thanks-preview b').exists()).toBe(false);`, add:

```ts
    expect(wrapper.find('#thanks-title').text()).toBe('Send a thank-you?');
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/Modals src/components/Auth/LoginForm.test.ts`

Expected: FAIL, 7 tests.
- `ModalView`:
  - `is named by its heading...`: no `aria-labelledby`;
  - `closes on Escape...`: the old event is `close-modal`;
  - `puts focus on the first focusable element...`: focus lands on the close button, first in the DOM;
  - `does not take focus back when unmounted after it was closed`: the old `onUnmounted` refocuses the stale element.
- `LoginForm`: `close` is not emitted (it emits `close-child-modal`).
- `DeleteConfirmModal` and `ThanksConfirmModal`: no heading id.

The two "never opened" and "ignores Escape while closed" tests already pass; they guard against regressions.

- [ ] **Step 3: Rewrite `src/components/Modals/ModalView.vue`**

Replace everything above `<style scoped>` (the whole `<script setup>` and `<template>`) with the block below. The `<style scoped>` block is unchanged.

```vue
<script setup lang="ts">
// What can take focus inside the dialog; disabled controls are skipped, as the browser does.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

import { ref, watch, nextTick, onUnmounted } from 'vue';

const props = defineProps<{
  isOpen: boolean;
  /** Id of the heading (or label) inside the slot that names the dialog. */
  labelledBy: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const modalRef = ref<HTMLElement | null>(null);

/** What had focus before the dialog opened. Null unless it really opened, so focus is never moved for nothing. */
let returnFocusTo: HTMLElement | null = null;

function close(): void {
  emit('close');
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

/** Keeps Tab and Shift+Tab inside the dialog. */
function handleTrapKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const focusable = getFocusableElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === modalRef.value)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function activate(): void {
  // Closed again before the content rendered: nothing to do.
  if (!props.isOpen) return;
  returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.addEventListener('keydown', handleDocumentKeydown);
  // The close button is last in the DOM, so this is the dialog's own first field or action.
  const [first] = getFocusableElements();
  (first ?? modalRef.value)?.focus();
}

function deactivate(): void {
  document.removeEventListener('keydown', handleDocumentKeydown);
  const target = returnFocusTo;
  returnFocusTo = null;
  if (target?.isConnected) target.focus();
}

watch(() => props.isOpen, (open) => {
  if (open) void nextTick(activate);
  else deactivate();
}, { immediate: true });

// Unmounted while open (e.g. sign-out): give focus back. Already closed: returnFocusTo is null, nothing moves.
onUnmounted(deactivate);
</script>

<template>
  <div
    v-if="isOpen"
    class="modal"
  >
    <div
      class="modal-overlay"
      @click="close"
    />
    <div
      ref="modalRef"
      class="modal-content"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="labelledBy"
      @keydown="handleTrapKeydown"
    >
      <slot />
      <!-- Last in the DOM, shown top-right: keyboard focus starts on the dialog's content. -->
      <button
        type="button"
        class="close-button"
        aria-label="Close"
        @click="close"
      >
        &times;
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Name each dialog and listen to `close`**

1. `src/components/Modals/WhatsNew.vue`:
   - replace `  (e: 'close-child-modal'): void;` with `  (e: 'close'): void;`;
   - replace `  emit('close-child-modal');` with `  emit('close');`;
   - replace `    <h2 class="winky-sans-700">` with:

```html
    <h2
      id="whats-new-title"
      class="winky-sans-700"
    >
```

2. `src/components/Modals/ThanksConfirmModal.vue`: replace `    <h2 class="thanks-title">` with:

```html
    <h2
      id="thanks-title"
      class="thanks-title"
    >
```

3. `src/components/Modals/DeleteConfirmModal.vue`: replace `    <h2 class="delete-title">` with:

```html
    <h2
      id="delete-title"
      class="delete-title"
    >
```

4. `src/components/Auth/LoginForm.vue`:
   - replace `  (e: 'close-child-modal'): void;` with `  (e: 'close'): void;`;
   - replace `    emit('close-child-modal');` with `    emit('close');`;
   - replace `    <h2 class="winky-sans-700">` with:

```html
    <h2
      id="login-title"
      class="winky-sans-700"
    >
```

5. `src/App.vue`: replace the two `ModalView` openings and the `WhatsNew` line:

```html
    <ModalView
      :is-open="showWhatsNew"
      @close-modal="handleWhatsNewClose"
    >
      <WhatsNew @close-child-modal="handleWhatsNewClose" />
    </ModalView>

    <ModalView
      :is-open="thanksMessage !== null"
      @close-modal="cancelThanks"
    >
```

with:

```html
    <ModalView
      :is-open="showWhatsNew"
      labelled-by="whats-new-title"
      @close="handleWhatsNewClose"
    >
      <WhatsNew @close="handleWhatsNewClose" />
    </ModalView>

    <ModalView
      :is-open="thanksMessage !== null"
      labelled-by="thanks-title"
      @close="cancelThanks"
    >
```

6. `src/components/LandingPage.vue`: replace:

```html
    <ModalView
      :is-open="showLoginForm"
      @close-modal="handleCloseLoginForm"
    >
      <LoginForm @close-modal="handleCloseLoginForm" />
```

with:

```html
    <ModalView
      :is-open="showLoginForm"
      labelled-by="login-title"
      @close="handleCloseLoginForm"
    >
      <LoginForm @close="handleCloseLoginForm" />
```

7. `src/components/Toot/ScheduledToots.vue`: replace `    @close-modal="handleDeleteCancel"` with:

```html
    labelled-by="delete-title"
    @close="handleDeleteCancel"
```

8. `src/components/MediaUpload.vue`:
   - replace `          @close-modal="editingMediaIndex = null"` with:

```html
          labelled-by="media-edit-title"
          @close="editingMediaIndex = null"
```

   - in the `<label class="winky-sans-700 media-edit-label" ...>` right below it, add `id="media-edit-title"` as its first attribute:

```html
          <label
            id="media-edit-title"
            class="winky-sans-700 media-edit-label"
            for="media-edit-input"
          >Add a description</label>
```

   Only the dialog that is open renders its content, so the id is unique on the page.

- [ ] **Step 5: Verify**

```bash
npx vitest run src/components/Modals src/components/Auth/LoginForm.test.ts
grep -rnE "close-modal|close-child-modal" src   # → no output
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected: `Tests  15 passed (15)`, no grep output, `exit=0` (a missing `labelled-by` would fail here: the prop is required), `0 errors`, `Tests  226 passed (226)`.

- [ ] **Step 6: Commit**

```bash
git add src/components/Modals/ModalView.vue src/components/Modals/ModalView.test.ts src/components/Modals/WhatsNew.vue src/components/Modals/ThanksConfirmModal.vue src/components/Modals/ThanksConfirmModal.test.ts src/components/Modals/DeleteConfirmModal.vue src/components/Modals/DeleteConfirmModal.test.ts src/components/Auth/LoginForm.vue src/components/Auth/LoginForm.test.ts src/App.vue src/components/LandingPage.vue src/components/Toot/ScheduledToots.vue src/components/MediaUpload.vue
git commit -m "fix(a11y): name dialogs, close them on Escape and manage focus; one close event

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/components/Modals/ModalView.vue", "src/components/Modals/ModalView.test.ts", "src/components/Modals/WhatsNew.vue", "src/components/Modals/ThanksConfirmModal.vue", "src/components/Modals/ThanksConfirmModal.test.ts", "src/components/Modals/DeleteConfirmModal.vue", "src/components/Modals/DeleteConfirmModal.test.ts", "src/components/Auth/LoginForm.vue", "src/components/Auth/LoginForm.test.ts", "src/App.vue", "src/components/LandingPage.vue", "src/components/Toot/ScheduledToots.vue", "src/components/MediaUpload.vue"], "verifyCommand": "npx vitest run src/components/Modals src/components/Auth/LoginForm.test.ts", "acceptanceCriteria": ["aria-labelledby from a required labelledBy prop; close button labelled", "Escape/close/overlay emit close; Escape only while open", "initial focus on the first focusable of the content", "focus restored only after a real opening", "single close event, dead slot listener removed", "heading id on every usage", "226 tests"], "requiresUserVerification": false}
```

---

### Task 4: Live regions, alerts, labels and readable contrast (WEB-01)

**Goal:**
- Screen readers hear the character count near the limit (not on every keystroke) and hear errors as soon as they appear.
- The text box and the icon-only media and poll toggles have names.
- The toggles show the composer's real state.
- A global `.visually-hidden` utility is added.
- Text that axe flags as serious (contrast below 4.5:1) is fixed, and the design-system skill records the corrected colors.

**Files:**
- Modify: `src/App.vue` (global `.visually-hidden`)
- Modify: `src/components/ContentArea.vue` (script and template)
- Test: `src/components/ContentArea.test.ts`
- Modify: `src/components/Toot/TootComposer.vue` (toggle props, `role="alert"`)
- Modify: `src/components/MediaUpload.vue`, `src/components/Auth/LoginForm.vue`, `src/components/Toot/ScheduledToots.vue` (`role="alert"`)
- Test: `src/components/MediaUpload.test.ts`, `src/components/Auth/LoginForm.test.ts`, `src/components/Toot/TootComposer.test.ts` (one assertion each)
- Modify (CSS only): `src/components/Modals/DeleteConfirmModal.vue`, `src/components/Modals/ThanksConfirmModal.vue`, `src/components/ControlsBar.vue`, plus the `.error`, counter and image-button rules of the files above
- Modify: `.claude/skills/ui-design-system/SKILL.md` (semantic colors)

**Acceptance Criteria:**
- [ ] A visually hidden `aria-live="polite"` region speaks only when the remaining count reaches or leaves a step (50, 20, 10, 0 left). It says, for example, `45 characters left`, `Character limit reached` or `3 characters over the limit`, and it is empty while far from the limit
- [ ] The visible counter keeps its number and adds hidden text, `characters left`. The textarea has `aria-label="Toot text"` and `aria-describedby="character-count"`
- [ ] The media and poll checkboxes have a `<label>` (`Add images`, `Add a poll`) using `.visually-hidden`, which replaces their `aria-label`. Their checked state comes from the composer (`showMedia`, `showPoll` props), not from local state that went out of sync
- [ ] The errors of the composer, upload, sign-in and scheduled list have `role="alert"`
- [ ] `.visually-hidden` is defined once, in `App.vue`'s global style
- [ ] Contrast, each pair at least 4.5:1:
  - error text `#c0392b` on `#fde8e7` (4.6:1);
  - the near-limit counter `#c0392b`;
  - the "Alt" image button white on `#333`;
  - the remove-image button and the Delete dialog button white on `#c0392b` (5.4:1);
  - the Thanks dialog Cancel `#333` on `#95a5a6` (4.9:1);
  - the edit-mode Update button white on `#2577b1` (4.8:1).

  Hovers use `filter: brightness()` instead of new colors. The `ui-design-system` skill lists the corrected values
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 229 tests

**Verify:** `npx vitest run src/components/ContentArea.test.ts src/components/MediaUpload.test.ts src/components/Auth/LoginForm.test.ts src/components/Toot/TootComposer.test.ts` → `Tests  25 passed (25)`

**Steps:**

**Why steps rather than every keystroke:** a polite live region that changed on each keystroke would queue an announcement for each one, talking over the user's own typing echo. Far from the limit the count isn't useful anyway. The region therefore changes only when the remaining count reaches or leaves a step (50, 20, 10, 0), and then says the exact count. A paste that jumps past several steps is still announced once, with the exact count. The visible counter, which the textarea's `aria-describedby` points to, can be read on demand at any time.

- [ ] **Step 1: Write the failing tests**

1. Replace the whole of `src/components/ContentArea.test.ts` with the version below. `mountArea` takes the two new props, and there are 3 new tests:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import ContentArea from './ContentArea.vue';
import { useInstanceStore } from '../stores/instance';

let pinia: Pinia;

function mountArea(modelValue = 'Hello', sections = { showMedia: false, showPoll: false }) {
  return mount(ContentArea, {
    props: { modelValue, hasPoll: false, hasMedia: false, ...sections },
    global: { plugins: [pinia] },
  });
}

describe('ContentArea', () => {
  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  it("uses Mastodon's default limit until the instance answers", () => {
    const wrapper = mountArea();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('500');
    expect(wrapper.find('.character-count').text()).toMatch(/^495\b/);
  });

  it("follows the instance's character limit", async () => {
    const wrapper = mountArea();
    useInstanceStore().maxCharacters = 1000;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('textarea').attributes('maxlength')).toBe('1000');
    expect(wrapper.find('.character-count').text()).toMatch(/^995\b/);
  });

  it('announces the remaining characters only when a step near the limit is reached', async () => {
    useInstanceStore().maxCharacters = 100;
    const wrapper = mountArea('');
    const liveRegion = () => wrapper.find('[aria-live="polite"]').text();
    expect(liveRegion()).toBe('');

    await wrapper.setProps({ modelValue: 'x'.repeat(40) });
    expect(liveRegion()).toBe('');

    await wrapper.setProps({ modelValue: 'x'.repeat(55) });
    expect(liveRegion()).toBe('45 characters left');

    await wrapper.setProps({ modelValue: 'x'.repeat(56) });
    expect(liveRegion()).toBe('45 characters left');

    await wrapper.setProps({ modelValue: 'x'.repeat(100) });
    expect(liveRegion()).toBe('Character limit reached');

    await wrapper.setProps({ modelValue: 'x'.repeat(10) });
    expect(liveRegion()).toBe('');
  });

  it('gives the text box and the media and poll toggles a name', () => {
    const wrapper = mountArea();

    expect(wrapper.find('textarea').attributes('aria-label')).toBe('Toot text');
    expect(wrapper.find('textarea').attributes('aria-describedby')).toBe('character-count');
    expect(wrapper.find('label[for="media"]').text()).toBe('Add images');
    expect(wrapper.find('label[for="poll"]').text()).toBe('Add a poll');
  });

  it("shows the composer's real state on the toggles", () => {
    const wrapper = mountArea('Hello', { showMedia: true, showPoll: false });

    expect((wrapper.find('#media').element as HTMLInputElement).checked).toBe(true);
    expect((wrapper.find('#poll').element as HTMLInputElement).checked).toBe(false);
    expect(wrapper.find('#poll').attributes('disabled')).toBeDefined();
  });
});
```

2. `src/components/MediaUpload.test.ts`: in `refuses a dropped file that is not a supported image, without uploading it`, after the `.error` text assertion, add:

```ts
    expect(wrapper.find('.error').attributes('role')).toBe('alert');
```

3. `src/components/Auth/LoginForm.test.ts`: in `refuses a plain http instance without contacting it`, after `expect(wrapper.find('.error').text()).toBe('The instance address must use https://');`, add the same line:

```ts
    expect(wrapper.find('.error').attributes('role')).toBe('alert');
```

4. `src/components/Toot/TootComposer.test.ts`: in `refuses a toot longer than the instance allows, without sending it` (Task 2), after the `.error` text assertion, add the same line:

```ts
    expect(wrapper.find('.error').attributes('role')).toBe('alert');
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/ContentArea.test.ts src/components/MediaUpload.test.ts src/components/Auth/LoginForm.test.ts src/components/Toot/TootComposer.test.ts`

Expected: FAIL.
- In `ContentArea`, the 3 new tests fail: there is no live region, the toggles have no `<label>`, and `#media` ignores `showMedia`.
- The 3 `role` assertions fail.
- The 2 Task 2 `ContentArea` tests still pass.

- [ ] **Step 3: Add the `.visually-hidden` utility**

In `src/App.vue`'s global `<style>`, the established place for app-wide classes, insert this right before `.app {`:

```css
/* Hidden on screen, still read by screen readers (labels of icon-only controls, live regions). */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

```

- [ ] **Step 4: Rewrite `src/components/ContentArea.vue`**

Replace everything above `<style scoped>` with the block below. The `<style scoped>` block is unchanged: the `input#media` and `input#poll` rules still apply.

The toggles listen to `click`, not `change`. A real click and the Space key both fire `click`, and happy-dom's `trigger('click')` does not fire `change`, which the existing poll test in `TootComposer.test.ts` relies on.

```vue
<script setup lang="ts">
// The live region speaks when the remaining count reaches one of these steps, never on every keystroke.
const ANNOUNCE_STEPS = [50, 20, 10, 0];

import { computed, ref, watch } from 'vue';
import { useInstanceStore } from '../stores/instance';

const props = defineProps<{
  modelValue: string;
  hasPoll: boolean;
  hasMedia: boolean;
  /** Whether the composer shows the media section: the toggle reflects it, it never keeps its own state. */
  showMedia: boolean;
  /** Whether the composer shows the poll section. */
  showPoll: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'add-media'): void;
  (e: 'add-poll'): void;
}>();

const instance = useInstanceStore();

const characterCount = computed(() => props.modelValue.length);
/** Against the instance's own limit (Mastodon's default 500 until it answers). */
const remainingCharacters = computed(() => instance.maxCharacters - characterCount.value);

/** How many steps the remaining count has reached; 0 while far from the limit. */
const announceLevel = computed(() => ANNOUNCE_STEPS.filter(step => remainingCharacters.value <= step).length);

/** Text of the live region: it changes, and is read, only when a step is reached or left. */
const announcement = ref('');

function describeRemaining(remaining: number): string {
  if (remaining === 0) return 'Character limit reached';
  const count = Math.abs(remaining);
  const characters = count === 1 ? 'character' : 'characters';
  return remaining > 0 ? `${count} ${characters} left` : `${count} ${characters} over the limit`;
}

watch(announceLevel, (level) => {
  announcement.value = level === 0 ? '' : describeRemaining(remainingCharacters.value);
});
</script>

<template>
  <div
    id="schedule-button"
    class="content-area"
  >
    <textarea
      :value="modelValue"
      :placeholder="'What\'s on your mind?'"
      aria-label="Toot text"
      aria-describedby="character-count"
      required
      :maxlength="instance.maxCharacters"
      rows="4"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="media-poll-controls">
      <input
        id="media"
        type="checkbox"
        :checked="showMedia"
        :disabled="showPoll || hasPoll"
        @click="emit('add-media')"
      >
      <label
        for="media"
        class="visually-hidden"
      >Add images</label>
      <input
        id="poll"
        type="checkbox"
        :checked="showPoll"
        :disabled="showMedia || hasMedia"
        @click="emit('add-poll')"
      >
      <label
        for="poll"
        class="visually-hidden"
      >Add a poll</label>
    </div>
    <div class="textarea-footer">
      <span
        id="character-count"
        class="character-count"
        :class="{ 'near-limit': remainingCharacters < 50 }"
      >
        {{ remainingCharacters }}<span class="visually-hidden"> characters left</span>
      </span>
      <span
        class="visually-hidden"
        aria-live="polite"
      >{{ announcement }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Pass the composer state and mark errors as alerts**

1. `src/components/Toot/TootComposer.vue`:
   - in the `<ContentArea ...>` usage, right after `:has-media="mediaAttachments.length > 0"`, add:

```html
        :show-media="showMedia"
        :show-poll="showPoll"
```

   - replace:

```html
      <p
        v-if="error"
        class="error"
      >
```

     with:

```html
      <p
        v-if="error"
        class="error"
        role="alert"
      >
```

2. `src/components/MediaUpload.vue`: add `role="alert"` after `class="error"` on `<p v-if="uploadError" class="error">`:

```html
    <p
      v-if="uploadError"
      class="error"
      role="alert"
    >
```

3. `src/components/Auth/LoginForm.vue`: same on `<p v-if="error" class="error">`:

```html
      <p
        v-if="error"
        class="error"
        role="alert"
      >
```

4. `src/components/Toot/ScheduledToots.vue`: same on `<div v-else-if="store.error" class="error">`:

```html
      <div
        v-else-if="store.error"
        class="error"
        role="alert"
      >
```

- [ ] **Step 6: Make text readable (contrast at least 4.5:1)**

A dry run of axe-core 4.14 on the production build of this plan reported each pair below as `serious` `color-contrast`. Once fixed, the same scans show no violation at all: landing, login dialog and error, composer with an image and near the limit, edit mode, composer error, the delete, Thanks and What's New dialogs, and the mobile menu. Happy-dom computes no styles, so there is no unit test for this; Task 9's axe run is the check. Only existing palette values are used (`#c0392b` was already the delete hover, `#2577b1` the edit hover); hovers use `filter: brightness()` instead of new colors.

| Where | Rule | Before → after | Ratio after |
|---|---|---|---|
| `TootComposer.vue`, `LoginForm.vue`, `ScheduledToots.vue` | `.error { color }` | `#e74c3c` → `#c0392b` | 4.6:1 on `#fde8e7` |
| `ContentArea.vue` | `.character-count.near-limit { color }` | `#ff4136` → `#c0392b` | 5.4:1 |
| `MediaUpload.vue` | `.edit-alt-button { background-color }` | `#cbcbcb` → `#333` | 12.6:1 |
| `MediaUpload.vue` | `.remove-button { background-color }` | `#ff4136` → `#c0392b` | 5.4:1 |
| `DeleteConfirmModal.vue` | `.btn-delete { background-color }` | `#e74c3c` → `#c0392b` | 5.4:1 |
| `ThanksConfirmModal.vue` | `.btn-cancel { color }` | `white` → `#333` | 4.9:1 on `#95a5a6` |
| `ControlsBar.vue` | `button.edit-mode { background-color }` | `#2b90d9` → `#2577b1` | 4.8:1 |

1. In each of `src/components/Toot/TootComposer.vue`, `src/components/Auth/LoginForm.vue` and `src/components/Toot/ScheduledToots.vue`, in the scoped `.error { ... }` rule, replace `  color: #e74c3c;` with `  color: #c0392b;`. `MediaUpload.vue`'s `.error` has no color rule; leave it.
2. `src/components/ContentArea.vue`: in `.character-count.near-limit`, replace `  color: #ff4136;` with `  color: #c0392b;`.
3. `src/components/MediaUpload.vue`:
   - in `.edit-alt-button`, replace `  background-color: #cbcbcb;` with `  background-color: #333;`;
   - in the second `.remove-button` rule (the one with `color: white`), replace `  background-color: #ff4136;` with `  background-color: #c0392b;`.
4. `src/components/Modals/DeleteConfirmModal.vue`: replace

```css
.btn-delete {
  background-color: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background-color: #c0392b;
}
```

   with:

```css
.btn-delete {
  background-color: #c0392b;
  color: white;
}

.btn-delete:hover {
  filter: brightness(0.85);
}
```

5. `src/components/Modals/ThanksConfirmModal.vue`: replace

```css
.btn-cancel {
  background-color: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}
```

   with:

```css
.btn-cancel {
  background-color: #95a5a6;
  color: #333;
}

.btn-cancel:hover {
  filter: brightness(1.1);
}
```

6. `src/components/ControlsBar.vue`: replace

```css
button.edit-mode {
  background-color: #2b90d9;
  color: white;
}

button.edit-mode:hover:not(:disabled) {
  background-color: #2577b1;
}
```

   with:

```css
button.edit-mode {
  background-color: #2577b1;
  color: white;
}

button.edit-mode:hover:not(:disabled) {
  background-color: #2577b1;
  filter: brightness(0.9);
}
```

7. `.claude/skills/ui-design-system/SKILL.md`, so future UI keeps these values:
   - replace the three rows of the "Semantic colors" table:

```markdown
| Error   | text `#e74c3c`, bg `#fde8e7`       |
| Edit    | `#2b90d9` (Mastodon blue), hover `#2577b1` |
| Neutral | `#95a5a6` (cancel buttons)         |
```

     with:

```markdown
| Error   | text `#c0392b`, bg `#fde8e7`; destructive buttons `#c0392b` with white text |
| Edit    | `#2577b1` (Mastodon blue) with white text, hover `filter: brightness(0.9)` |
| Neutral | `#95a5a6` with `#333` text (cancel buttons) |

Text must keep a contrast of at least 4.5:1 (3:1 from 24px, or 18.66px bold), as axe and Lighthouse check.
White on `#e74c3c` (3.8:1), `#2b90d9` (3.4:1) or `#95a5a6` (2.6:1) fails; so does `#e74c3c` on `#fde8e7` (3.3:1).
```

   - in the "Neutral / cancel button" example, replace `  color: white;` with `  color: #333;`, and `.btn-cancel:hover:not(:disabled) { background-color: #7f8c8d; }` with `.btn-cancel:hover:not(:disabled) { filter: brightness(1.1); }`;
   - in the "Error message" example, replace `  color: #e74c3c;` with `  color: #c0392b;`.

- [ ] **Step 7: Verify**

```bash
npx vitest run src/components/ContentArea.test.ts src/components/MediaUpload.test.ts src/components/Auth/LoginForm.test.ts src/components/Toot/TootComposer.test.ts
grep -n 'aria-label="Upload media"\|isMediaChecked' src/components/ContentArea.vue   # → no output
grep -rn "e74c3c\|ff4136\|cbcbcb\|2b90d9" src --include='*.vue'
# → only PollSection's large "×" (#e74c3c, 24px: 3:1 is enough) and MediaUpload's borders and progress bar (#2b90d9, no text)
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected:
- `Tests  25 passed (25)`;
- no output from the first grep; the second lists only the 4 lines noted;
- `exit=0`, `0 errors`, `Tests  229 passed (229)`.

The existing poll test, `does not send a poll that was opened, filled in and closed again`, must still pass.

- [ ] **Step 8: Commit**

```bash
git add src/App.vue src/components/ContentArea.vue src/components/ContentArea.test.ts src/components/Toot/TootComposer.vue src/components/Toot/TootComposer.test.ts src/components/MediaUpload.vue src/components/MediaUpload.test.ts src/components/Auth/LoginForm.vue src/components/Auth/LoginForm.test.ts src/components/Toot/ScheduledToots.vue src/components/Modals/DeleteConfirmModal.vue src/components/Modals/ThanksConfirmModal.vue src/components/ControlsBar.vue .claude/skills/ui-design-system/SKILL.md
git commit -m "fix(a11y): announce the character limit, alert errors, label the toggles, readable contrast

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/App.vue", "src/components/ContentArea.vue", "src/components/ContentArea.test.ts", "src/components/Toot/TootComposer.vue", "src/components/Toot/TootComposer.test.ts", "src/components/MediaUpload.vue", "src/components/MediaUpload.test.ts", "src/components/Auth/LoginForm.vue", "src/components/Auth/LoginForm.test.ts", "src/components/Toot/ScheduledToots.vue", "src/components/Modals/DeleteConfirmModal.vue", "src/components/Modals/ThanksConfirmModal.vue", "src/components/ControlsBar.vue", ".claude/skills/ui-design-system/SKILL.md"], "verifyCommand": "npx vitest run src/components/ContentArea.test.ts src/components/MediaUpload.test.ts src/components/Auth/LoginForm.test.ts src/components/Toot/TootComposer.test.ts", "acceptanceCriteria": ["polite live region speaks only at 50/20/10/0 steps", "counter and textarea described", "media/poll toggles labelled and controlled by the composer", "errors are role=alert", ".visually-hidden global utility", "text contrast >= 4.5:1, skill updated", "229 tests"], "requiresUserVerification": false}
```

---

### Task 5: Page structure and an accessible mobile menu (WEB-01)

**Goal:**
- Every view has exactly one `<h1>`, and `App.vue` wraps the routed view in the only `<main>`.
- The burger menu becomes a `MobileNav` component. It has a name, says what it controls and whether it is open, closes on Escape, and gives focus back to its button. Its hidden items can no longer be reached with Tab.

**Files:**
- Create: `src/components/MobileNav.vue`
- Create: `src/components/MobileNav.test.ts`
- Modify: `src/App.vue` (header title, `<MobileNav>`, `<main>`, styles)
- Create: `src/App.test.ts`
- Modify: `src/components/LandingPage.vue` (`<main>` → `<div class="landing-content">`)
- Create: `src/components/LandingPage.test.ts`
- Modify: `src/components/Toot/TootComposer.vue` (visually hidden `<h1>`)
- Test: `src/components/Toot/TootComposer.test.ts` (one new test)
- Modify: `src/components/Toot/ScheduledToots.vue` (`<h1>` → `<h2>`)
- Modify: `src/components/OAuthCallback.vue` (`<p>` → `<h1>`)

**Acceptance Criteria:**
- [ ] The header's "Toot Scheduler" is a `<p>`, and each view owns its `<h1>`:
  - landing: its hero title;
  - composer: a visually hidden `Schedule a toot`, with `Scheduled Toots (n)` becoming an `<h2>`;
  - callback: `Authenticating...`
- [ ] `App.vue` renders `<main class="app-main">` around `<RouterView />`, and `LandingPage` no longer has its own `<main>`. Its old `main` styles move to `.landing-content`, so the full-width hero is unchanged
- [ ] `MobileNav`:
  - the burger has `aria-label="Menu"`, `aria-controls="mobile-menu"` and `aria-expanded` set to `"true"` or `"false"`;
  - Escape closes the menu and focuses the burger;
  - choosing an item closes the menu and focuses the burger, so a dialog opened next returns focus there;
  - the closed menu is `visibility: hidden`, so Tab and screen readers skip it;
  - the notification dot and the "What's New" bubble are `aria-hidden`
- [ ] The visual result is unchanged, except the "What's New" bubble text, which becomes `#333` for contrast. The mobile styles move from `App.vue` to `MobileNav.vue` (scoped)
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 236 tests

**Verify:** `npx vitest run src/components/MobileNav.test.ts src/App.test.ts src/components/LandingPage.test.ts src/components/Toot/TootComposer.test.ts` → `Tests  15 passed (15)`

**Steps:**

**Why a component:** testing the burger inside `App.vue` would mean mounting the whole app (router, toasts, session timer, three stores) for every check. `MobileNav` takes `hasNewFeatures` and emits `whats-new`, `thanks` or `logout`, so it is tested on its own, and `App.vue` gets shorter.

- [ ] **Step 1: Write the failing tests**

1. Create `src/components/MobileNav.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import MobileNav from './MobileNav.vue';

let wrapper: VueWrapper;

function mountNav(): VueWrapper {
  wrapper = mount(MobileNav, { props: { hasNewFeatures: true }, attachTo: document.body });
  return wrapper;
}

describe('MobileNav', () => {
  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('has a named menu button that says which element it controls and whether it is open', () => {
    const button = mountNav().find('.burger-menu');

    expect(button.attributes('aria-label')).toBe('Menu');
    expect(button.attributes('aria-controls')).toBe('mobile-menu');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(wrapper.find('#mobile-menu').exists()).toBe(true);
  });

  it('opens and closes from the menu button', async () => {
    const button = mountNav().find('.burger-menu');

    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('#mobile-menu').classes()).toContain('is-open');

    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
  });

  it('closes on Escape and gives focus back to the menu button', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');
    (wrapper.find('.logout-button').element as HTMLButtonElement).focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(button.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button.element);
  });

  it('closes before running the chosen action', async () => {
    const button = mountNav().find('.burger-menu');
    await button.trigger('click');

    await wrapper.find('.thanks-button').trigger('click');

    expect(wrapper.emitted('thanks')).toHaveLength(1);
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button.element);
  });
});
```

2. Create `src/App.test.ts`. The routed page is a render function, so no template compiler is needed:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { defineComponent, h } from 'vue';

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }));
vi.mock('vue-toastification', () => ({ useToast: () => toast }));

import App from './App.vue';

const Page = defineComponent({ render: () => h('h1', 'A page') });

async function mountApp() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'home', component: Page }] });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  return wrapper;
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the page inside the only <main>, and leaves the <h1> to the page', async () => {
    const wrapper = await mountApp();

    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(wrapper.find('main h1').text()).toBe('A page');
    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('.header-title').element.tagName).toBe('P');
  });
});
```

3. Create `src/components/LandingPage.test.ts`. The login dialog is closed, so `LoginForm` is not created and no store is needed:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import LandingPage from './LandingPage.vue';

describe('LandingPage', () => {
  it('has one <h1> and no <main> of its own (App provides it)', () => {
    const wrapper = mount(LandingPage);

    expect(wrapper.findAll('h1')).toHaveLength(1);
    expect(wrapper.find('main').exists()).toBe(false);
  });
});
```

4. `src/components/Toot/TootComposer.test.ts`: insert this test right before `  it('sends a single request when the form is submitted twice quickly', async () => {`:

```ts
  it('has one <h1>; the scheduled list is a section under it', async () => {
    const wrapper = mountComposer();
    await flushPromises();

    expect(wrapper.findAll('h1').map(heading => heading.text())).toEqual(['Schedule a toot']);
    expect(wrapper.find('.toots-summary h2').text()).toBe('Scheduled Toots (0)');
  });

```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/MobileNav.test.ts src/App.test.ts src/components/LandingPage.test.ts src/components/Toot/TootComposer.test.ts`

Expected: FAIL.
- `MobileNav.test.ts` cannot resolve `./MobileNav.vue`.
- `App`: there is no `<main>`, and the header title is an `<h1>`.
- `LandingPage`: it has its own `<main>`.
- `TootComposer`: there is no `Schedule a toot` heading, and the list title is an `<h1>`.

- [ ] **Step 3: Create `src/components/MobileNav.vue`**

The markup and styles come from `App.vue`; what changed:
- the ARIA attributes, Escape and focus handling;
- the `visibility` rules, which take the closed menu out of the Tab order once its slide-out ends;
- `aria-hidden` on the decorative dot and bubble;
- the bubble's text is `#333` instead of white. White on orange is 2.2:1, which axe flags while the bubble is shown; `#333` gives 5.6:1, like the desktop "What's New" button.

The shared button classes (`.whats-new-button`, `.thanks-button`, `.logout-button`, `.thanks-button-icon`) stay global in `App.vue`.

```vue
<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import Send from './icons/Send.vue';

/** What a menu item asks the app to do. */
type MenuAction = 'whats-new' | 'thanks' | 'logout';

defineProps<{
  hasNewFeatures: boolean;
}>();

const emit = defineEmits<{
  (e: MenuAction): void;
}>();

const isOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);

function toggle(): void {
  isOpen.value = !isOpen.value;
}

function closeAndFocusButton(): void {
  isOpen.value = false;
  menuButton.value?.focus();
}

function choose(action: MenuAction): void {
  // Focus moves to the menu button first: a dialog opened next gives focus back there, not to a hidden item.
  closeAndFocusButton();
  emit(action);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeAndFocusButton();
}

// Escape is only listened to while the menu is open.
watch(isOpen, (open) => {
  if (open) document.addEventListener('keydown', handleKeydown);
  else document.removeEventListener('keydown', handleKeydown);
});

onUnmounted(() => document.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div class="mobile-nav">
    <span
      v-if="hasNewFeatures"
      class="notification-dot"
      :class="{ 'notification-dot--none': isOpen }"
      aria-hidden="true"
    />
    <span
      v-if="hasNewFeatures"
      class="whats-new-mobile-label"
      :class="{ 'whats-new-mobile-label--none': isOpen }"
      aria-hidden="true"
    >What's New</span>
    <button
      ref="menuButton"
      type="button"
      class="burger-menu"
      :class="{ 'is-open': isOpen }"
      aria-label="Menu"
      aria-controls="mobile-menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      @click="toggle"
    >
      <span />
      <span />
      <span />
    </button>
    <div
      id="mobile-menu"
      class="mobile-menu"
      :class="{ 'is-open': isOpen }"
    >
      <span class="mobile-menu-spacer">
        <button
          v-if="hasNewFeatures"
          type="button"
          class="whats-new-button"
          @click="choose('whats-new')"
        >
          What's New
        </button>
        <button
          type="button"
          class="thanks-button"
          @click="choose('thanks')"
        >
          <Send class="thanks-button-icon" />
          Say Thanks
        </button>
      </span>
      <button
        type="button"
        class="logout-button"
        @click="choose('logout')"
      >
        Logout
      </button>
    </div>
  </div>
</template>

<style scoped>
.mobile-nav {
  position: relative;
  display: none;
}

.burger-menu {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.burger-menu span {
  display: block;
  width: 25px;
  height: 3px;
  border-radius: 5px;
  background-color: #333;
  transition: all 0.3s ease;
}

.notification-dot {
  position: absolute;
  top: 0.2rem;
  right: 0.2rem;
  width: 0.65rem;
  height: 0.65rem;
  background-color: #FF9200;
  border-radius: 50%;
  z-index: 10;
  pointer-events: none;
}

.whats-new-mobile-label {
  position: absolute;
  top: 0.4rem;
  right: 2.6rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #333;
  background-color: #FF9200;
  padding: 0.2rem 0.5rem;
  border-radius: 0.5rem;
  z-index: 10;
  display: inline-block;
  text-wrap: nowrap;
  animation: enter-from-right-fade-in-and-out 3s ease forwards;
}

@keyframes enter-from-right-fade-in-and-out {
  0% {
    opacity: 0;
    transform: translateX(20%);
  }
  10%, 80% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
  }
}

.notification-dot--none {
  display: none;
}

.burger-menu.is-open span:nth-child(1) {
  transform: translateY(9px) rotate(45deg);
}

.burger-menu.is-open span:nth-child(2) {
  opacity: 0;
}

.burger-menu.is-open span:nth-child(3) {
  transform: translateY(-9px) rotate(-45deg);
}

/* Closed: off-screen and hidden, so neither Tab nor a screen reader reaches its items. */
.mobile-menu {
  position: fixed;
  top: 60px;
  right: -100%;
  width: 100%;
  height: calc(100dvh - 60px);
  background-color: #f5f5f5;
  padding: 1rem;
  visibility: hidden;
  transition: right 0.3s ease, visibility 0s linear 0.3s;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
}

.mobile-menu-spacer {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mobile-menu.is-open {
  right: 0;
  visibility: visible;
  transition: right 0.3s ease;
}

@media (max-width: 768px) {
  .mobile-nav {
    display: block;
  }
}
</style>
```

- [ ] **Step 4: Update `src/App.vue`**

1. Script:
   - right after `import Send from './components/icons/Send.vue';`, add `import MobileNav from './components/MobileNav.vue';`;
   - delete `const isMenuOpen = ref(false);`;
   - delete the `isMenuOpen.value = false;` line in `handleLogout` and the one in `openThanks`;
   - delete the whole `toggleMenu` function.
2. Template:
   - replace the header title:

```html
      <h1 class="header-title winky-sans-900">
        Toot Scheduler
      </h1>
```

     with:

```html
      <!-- The app name, not a heading: each page has its own main heading. -->
      <p class="header-title winky-sans-900">
        Toot Scheduler
      </p>
```

   - replace the whole mobile block, from `      <div` with `v-if="auth.accessToken"` and `class="mobile-nav"` (right after `<!-- Mobile Burger Menu -->`) down to its closing `      </div>` just before `    </header>`, with:

```html
      <MobileNav
        v-if="auth.accessToken"
        :has-new-features="hasNewFeatures"
        @whats-new="showWhatsNew = true"
        @thanks="openThanks"
        @logout="handleLogout"
      />
```

   - replace `    <RouterView />` with:

```html
    <main class="app-main">
      <RouterView />
    </main>
```

3. Global `<style>`:
   - delete everything from `/* Mobile Navigation Styles */` up to, but not including, `/* Desktop Navigation Styles */`. That covers `.mobile-nav`, `.burger-menu`, `.notification-dot`, `.whats-new-mobile-label`, the keyframes, `.notification-dot--none`, the `.burger-menu.is-open` rules, `.mobile-menu`, `.mobile-menu-spacer` and `.mobile-menu.is-open`;
   - in `@media (max-width: 768px)`, delete the `.mobile-nav { display: block; }` rule and keep `.desktop-nav { display: none; }`;
   - replace the `main { ... }` rule with:

```css
.app-main {
  flex: 1;
  width: 100%;
}
```

   Its old padding and width move to the landing content (step 5); the composer already sets its own width and margins.

- [ ] **Step 5: One `<h1>` per view, no nested `<main>`**

1. `src/components/LandingPage.vue`:
   - replace `  <main>` (before `<div class="landing-how-it-works">`) with `  <div class="landing-content">`, and the matching `  </main>` (before `</template>`) with `  </div>`;
   - at the top of its `<style>`, add:

```css
.landing-content {
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

```

2. `src/components/Toot/TootComposer.vue`: right after `  <div class="toot-composer">`, add:

```html
    <h1 class="visually-hidden">
      Schedule a toot
    </h1>
```

3. `src/components/Toot/ScheduledToots.vue`: replace `        <h1>Scheduled Toots ({{ store.count }})</h1>` with `        <h2>Scheduled Toots ({{ store.count }})</h2>`. In its `<style scoped>`, rename the `h1 {` selector (font-size 1.5rem) to `h2 {`.

4. `src/components/OAuthCallback.vue`:
   - replace `      <p>Authenticating...</p>` with:

```html
      <h1 class="loading-title">
        Authenticating...
      </h1>
```

   - at the end of its `<style scoped>`, add:

```css

.loading-title {
  font-size: 1rem;
  font-weight: 400;
}
```

- [ ] **Step 6: Verify**

```bash
npx vitest run src/components/MobileNav.test.ts src/App.test.ts src/components/LandingPage.test.ts src/components/Toot/TootComposer.test.ts
grep -rn "<main\|isMenuOpen" src --include='*.vue'   # → only App.vue's <main class="app-main">
grep -rn "<h1" src --include='*.vue'                 # → LandingPage, TootComposer, OAuthCallback
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected:
- `Tests  15 passed (15)`;
- the two greps list exactly the files above;
- `exit=0`, `0 errors`, `Tests  236 passed (236)`.

- [ ] **Step 7: Commit**

```bash
git add src/components/MobileNav.vue src/components/MobileNav.test.ts src/App.vue src/App.test.ts src/components/LandingPage.vue src/components/LandingPage.test.ts src/components/Toot/TootComposer.vue src/components/Toot/TootComposer.test.ts src/components/Toot/ScheduledToots.vue src/components/OAuthCallback.vue
git commit -m "fix(a11y): one h1 and one main per page; accessible, Escape-closable mobile menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/components/MobileNav.vue", "src/components/MobileNav.test.ts", "src/App.vue", "src/App.test.ts", "src/components/LandingPage.vue", "src/components/LandingPage.test.ts", "src/components/Toot/TootComposer.vue", "src/components/Toot/TootComposer.test.ts", "src/components/Toot/ScheduledToots.vue", "src/components/OAuthCallback.vue"], "verifyCommand": "npx vitest run src/components/MobileNav.test.ts src/App.test.ts src/components/LandingPage.test.ts src/components/Toot/TootComposer.test.ts", "acceptanceCriteria": ["one h1 per view, header title is a p", "single main around RouterView, none in LandingPage", "burger: aria-label/controls/expanded, Escape closes and refocuses, items close first, hidden menu unreachable", "visual result unchanged", "236 tests"], "requiresUserVerification": false}
```

---

### Task 6: Toot cards: unique ids, emitted events, progress on the right card (BUG-06, CC-10)

**Goal:**
- Each card's content-warning toggle has its own id, so a label reveals its own toot (BUG-06).
- Cards emit `edit` and `delete` instead of taking callback props.
- "Deleting…" or "Updating…" shows only on the toot concerned (CC-10), driven by `pendingId` and `pendingAction` in the store instead of the global `isLoading`.
- After Edit, focus goes to the text box; after a deletion, to the list heading.

**Files:**
- Modify: `src/stores/scheduledToots.ts` (`PendingAction`, `pendingId`, `pendingAction`, `deleteToot`, `updateToot`)
- Test: `src/stores/scheduledToots.test.ts`
- Modify: `src/components/Toot/TootCard.vue` (script and template)
- Create: `src/components/Toot/TootCard.test.ts`
- Modify: `src/components/Toot/ScheduledToots.vue` (script and template)
- Create: `src/components/Toot/ScheduledToots.test.ts`

**Acceptance Criteria:**
- [ ] Two sensitive cards have the ids `sensitive-<id>`, each with its own `label for`. Toggling card B reveals only card B. The redundant `@click` and the shared `name` are removed, and the label reads `Show the content behind this warning: <warning text>`
- [ ] `TootCard` emits `edit(id)` and `delete(id)`. The `onEdit` and `onDelete` props are gone
- [ ] Store:
  - `deleteToot(id)` sets `pendingId`/`pendingAction = 'delete'` while it runs, reloads the list, returns `true`, or sets `error` and returns `false`;
  - `updateToot` sets `pendingAction = 'update'` on the original instead of the global `isLoading`;
  - progress is only cleared for the toot that set it
- [ ] A card shows `Deleting…` or `Updating…` only when it is the pending one, and both its buttons are then disabled. Every other card keeps `Edit`/`Delete` enabled, and "Editing…" is gone
- [ ] The list stays visible while it refreshes. "Loading scheduled toots…" only shows when nothing is loaded yet
- [ ] After a confirmed deletion, focus moves to the list `<summary>`. After Edit, the composer text box is focused
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 246 tests

**Verify:** `npx vitest run src/components/Toot src/stores/scheduledToots.test.ts` → `Tests  32 passed (32)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Create `src/components/Toot/TootCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import TootCard from './TootCard.vue';

const base = { scheduledAt: '2031-01-01T12:00:00.000Z', text: 'Hello' };

function mountCard(props: Record<string, unknown> = {}) {
  return mount(TootCard, { props: { id: '1', ...base, ...props } });
}

describe('TootCard', () => {
  it('gives each sensitive card its own toggle, so a label only reveals its own toot', async () => {
    const TwoCards = defineComponent({
      render: () => [
        h(TootCard, { id: 'a', ...base, sensitive: true, spoiler_text: 'Spoiler A' }),
        h(TootCard, { id: 'b', ...base, sensitive: true, spoiler_text: 'Spoiler B' }),
      ],
    });
    const wrapper = mount(TwoCards);
    const [cardA, cardB] = wrapper.findAll('.toot-card');

    expect(cardA.find('input').attributes('id')).toBe('sensitive-a');
    expect(cardB.find('input').attributes('id')).toBe('sensitive-b');
    expect(cardA.find('label').attributes('for')).toBe('sensitive-a');
    expect(cardB.find('label').attributes('for')).toBe('sensitive-b');

    await cardB.find('input').setValue(true);

    expect(cardB.find('.toot-content p').classes()).not.toContain('blurred');
    expect(cardA.find('.toot-content p').classes()).toContain('blurred');
  });

  it('names the toggle after what it does', () => {
    const label = mountCard({ sensitive: true, spoiler_text: 'Spoiler' }).find('label');

    expect(label.text()).toBe('Show the content behind this warning: Spoiler');
  });

  it('emits edit and delete with its id', async () => {
    const wrapper = mountCard({ id: '42' });

    await wrapper.find('.edit-button').trigger('click');
    await wrapper.find('.delete-button').trigger('click');

    expect(wrapper.emitted('edit')).toEqual([['42']]);
    expect(wrapper.emitted('delete')).toEqual([['42']]);
  });

  it('shows only what is being done to this toot', () => {
    const idle = mountCard();
    expect(idle.find('.edit-button').text()).toBe('Edit');
    expect(idle.find('.delete-button').text()).toBe('Delete');
    expect(idle.find('.delete-button').attributes('disabled')).toBeUndefined();

    const deleting = mountCard({ pendingAction: 'delete' });
    expect(deleting.find('.edit-button').text()).toBe('Edit');
    expect(deleting.find('.delete-button').text()).toBe('Deleting…');
    expect(deleting.find('.edit-button').attributes('disabled')).toBeDefined();
    expect(deleting.find('.delete-button').attributes('disabled')).toBeDefined();

    expect(mountCard({ pendingAction: 'update' }).find('.edit-button').text()).toBe('Updating…');
  });
});
```

2. Create `src/components/Toot/ScheduledToots.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({ getScheduledToots: vi.fn(), deleteScheduledToot: vi.fn() }));
vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';

function scheduledToot(id: string, day: number): MastodonStatus {
  return {
    id,
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
    media_attachments: [],
    scheduled_at: `2031-01-0${day}T12:00:00.000Z`,
    params: { text: `Toot ${id}`, visibility: 'public', language: 'en', poll: null },
  };
}

let pinia: Pinia;
let wrapper: VueWrapper;

async function mountList(): Promise<VueWrapper> {
  wrapper = mount(ScheduledToots, { global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe('ScheduledToots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockResolvedValue([scheduledToot('a', 1), scheduledToot('b', 2)]);
  });

  afterEach(() => {
    wrapper.unmount();
    document.body.innerHTML = '';
  });

  it('shows progress only on the card being deleted, and keeps the list while it refreshes', async () => {
    await mountList();
    const store = useScheduledTootsStore();
    store.pendingId = 'a';
    store.pendingAction = 'delete';
    store.setLoading(true);
    await flushPromises();

    expect(wrapper.find('.loading').exists()).toBe(false);
    expect(wrapper.findAll('.delete-button').map(button => button.text())).toEqual(['Deleting…', 'Delete']);
  });

  it('deletes after confirmation and moves focus to the list heading', async () => {
    api.deleteScheduledToot.mockResolvedValue(undefined);
    await mountList();
    api.getScheduledToots.mockResolvedValue([scheduledToot('b', 2)]);

    await wrapper.findAll('.delete-button')[0].trigger('click');
    await wrapper.find('.btn-delete').trigger('click');
    await flushPromises();

    expect(api.deleteScheduledToot).toHaveBeenCalledWith('a');
    expect(wrapper.findAll('.toot-card')).toHaveLength(1);
    expect(document.activeElement).toBe(wrapper.find('.toots-summary').element);
  });

  it('shows a failed deletion as an alert', async () => {
    api.deleteScheduledToot.mockRejectedValue(new Error('Record not found'));
    await mountList();

    await wrapper.findAll('.delete-button')[0].trigger('click');
    await wrapper.find('.btn-delete').trigger('click');
    await flushPromises();

    expect(wrapper.find('.error').text()).toBe('Record not found');
    expect(wrapper.find('.error').attributes('role')).toBe('alert');
  });
});
```

3. `src/stores/scheduledToots.test.ts`: replace `  describe('updateToot', () => {` (the line itself) with the block below. It adds a `deleteToot` group and a first `updateToot` test; the existing `updateToot` tests follow unchanged.

```ts
  describe('deleteToot', () => {
    it('marks only the deleted toot as in progress, then reloads the list', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.deleteScheduledToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));

      const deleting = store.deleteToot('42');
      expect(store.pendingId).toBe('42');
      expect(store.pendingAction).toBe('delete');
      expect(store.isLoading).toBe(false);

      finish();
      expect(await deleting).toBe(true);
      expect(api.getScheduledToots).toHaveBeenCalled();
      expect(store.pendingId).toBeNull();
      expect(store.pendingAction).toBeNull();
    });

    it('reports a failed deletion', async () => {
      const store = useScheduledTootsStore();
      api.deleteScheduledToot.mockRejectedValue(new Error('Record not found'));

      expect(await store.deleteToot('42')).toBe(false);
      expect(store.error).toBe('Record not found');
      expect(store.pendingId).toBeNull();
    });
  });

  describe('updateToot', () => {
    it('marks the edited toot as in progress while it is updated', async () => {
      const store = useScheduledTootsStore();
      let finish!: () => void;
      api.rescheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));

      const updating = store.updateToot(original, makeUpdated(), 'key-1');
      expect(store.pendingId).toBe('42');
      expect(store.pendingAction).toBe('update');

      finish();
      await updating;
      expect(store.pendingId).toBeNull();
    });

```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components/Toot src/stores/scheduledToots.test.ts`

Expected: FAIL.
- `TootCard`:
  - both inputs have the id `sensitive`;
  - the label has no hidden prefix;
  - no `edit`/`delete` event is emitted (the card calls the missing `onEdit`/`onDelete` props);
  - the old labels read `Editing...`/`Deleting...` with three dots.
- `ScheduledToots`: the list is replaced by "Loading", and focus does not reach the summary.
- Store: `store.deleteToot is not a function`, and `pendingId` stays undefined.

`shows a failed deletion as an alert` already passes, since Task 4 added the role; it guards the new path.

- [ ] **Step 3: Progress per toot in `src/stores/scheduledToots.ts`**

1. Right before `/** Outcome of an edit, so the UI can warn when a stale copy is left behind. */`, add:

```ts
/** What can be in progress on one scheduled toot; only its card shows it. */
export type PendingAction = 'delete' | 'update';

```

2. Right after `  const editingToot = ref<MastodonStatus | null>(null);`, add:

```ts
  /** The toot being deleted or updated, and what is being done to it. */
  const pendingId = ref<string | null>(null);
  const pendingAction = ref<PendingAction | null>(null);
```

3. Right after the `setEditingToot` function, add:

```ts

  function startPending(id: string, action: PendingAction): void {
    pendingId.value = id;
    pendingAction.value = action;
  }

  /** Clears this toot's progress, unless an operation on another toot started meanwhile. */
  function finishPending(id: string): void {
    if (pendingId.value !== id) return;
    pendingId.value = null;
    pendingAction.value = null;
  }
```

4. Right before the JSDoc of `updateToot` (`  /**` followed by `   * Applies an edit to a scheduled toot without ever losing the original.`), add:

```ts
  /**
   * Deletes a scheduled toot, then reloads the list. Only that toot is marked as in progress.
   * @param {string} id - The ID of the scheduled toot.
   * @returns {Promise<boolean>} True once deleted; false on failure (the error is in `error`).
   */
  async function deleteToot(id: string): Promise<boolean> {
    startPending(id, 'delete');
    try {
      setError('');
      await useMastodonApi().deleteScheduledToot(id);
      await fetchScheduledToots();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete toot');
      return false;
    } finally {
      finishPending(id);
    }
  }

```

5. In `updateToot`:
   - replace the first `      setLoading(true);` (right after `    try {`) with `      startPending(original.id, 'update');`;
   - in its `finally`, replace `      setLoading(false);` with `      finishPending(original.id);`.

   `fetchScheduledToots` keeps using `setLoading` for the list itself.

6. In the returned object:
   - right after `    editingToot,`, add `    pendingId,` and `    pendingAction,`;
   - right after `    fetchScheduledToots,`, add `    deleteToot,`.

- [ ] **Step 4: Rewrite `src/components/Toot/TootCard.vue`**

Replace everything above `<style scoped>` with the block below. The style is unchanged; `.sensitive-warning input[type="checkbox"]` still matches.

```vue
<script setup lang="ts">
import { format } from 'date-fns';
import { ref, computed } from 'vue';
import type { PollParams } from '../../types/mastodon';
import type { PendingAction } from '../../stores/scheduledToots';

interface Props {
  id: string;
  scheduledAt: string;
  text?: string;
  visibility?: string;
  language?: string;
  sensitive?: boolean;
  medias?: Array<{ id: string; description: string; preview_url: string }>;
  poll?: PollParams | null;
  spoiler_text?: string;
  /** What is being done to this toot right now; other cards are not affected. */
  pendingAction?: PendingAction | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'edit', id: string): void;
  (e: 'delete', id: string): void;
}>();

const languages = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  ja: '日本語',
  zh: '中文',
  ko: '한국어',
  nl: 'Nederlands',
  pl: 'Polski',
  ar: 'العربية',
  hi: 'हिन्दी',
} as const;

function formatDateTime(date: string) {
  return format(new Date(date), 'MMM d, yyyy HH:mm');
}

function getCapitalizedVisibility(visibility: string | undefined): string {
  if (!visibility) return 'Public';
  return visibility.charAt(0).toUpperCase() + visibility.slice(1);
}

function getLanguageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return languages[code as keyof typeof languages] || code;
}

const showSensitiveContent = ref(!props.sensitive);

/** One per card: a shared id made every label toggle the first card. */
const sensitiveId = computed(() => `sensitive-${props.id}`);

const isPending = computed(() => !!props.pendingAction);

const hasMedia = computed(() => {
  return props.medias && props.medias.length > 0;
});

const hasPoll = computed(() => {
  return props.poll
});

</script>

<template>
  <div class="toot-card">
    <div class="toot-header">
      <div class="meta-row">
        <span class="meta-label">Scheduled for:
          {{ formatDateTime(props.scheduledAt) }}
        </span>
      </div>
      <div class="actions">
        <button
          type="button"
          class="edit-button"
          :disabled="isPending"
          @click="emit('edit', props.id)"
        >
          {{ props.pendingAction === 'update' ? 'Updating…' : 'Edit' }}
        </button>
        <button
          type="button"
          class="delete-button"
          :disabled="isPending"
          @click="emit('delete', props.id)"
        >
          {{ props.pendingAction === 'delete' ? 'Deleting…' : 'Delete' }}
        </button>
      </div>
    </div>
    <div
      v-if="props.sensitive"
      class="sensitive-warning"
    >
      <input
        :id="sensitiveId"
        v-model="showSensitiveContent"
        type="checkbox"
      >

      <label :for="sensitiveId"><span class="visually-hidden">Show the content behind this warning: </span>{{ props.spoiler_text }}</label>
    </div>
    <div class="toot-content">
      <p :class="{ blurred: !showSensitiveContent }">
        {{ props.text }}
      </p>
    </div>

    <div class="toot-footer">
      {{ getCapitalizedVisibility(props.visibility) }} toot in {{ getLanguageName(props.language) }} <span v-if="hasMedia">- with {{ medias?.length }} media</span> <span v-if="hasPoll">- with poll</span>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Rewrite `src/components/Toot/ScheduledToots.vue`**

Replace everything above `<style scoped>` with the block below. The style is unchanged. Compared with Task 5's version:
- `useMastodonApi` is no longer imported, since the store deletes;
- `listSummary` and the focus moves are added;
- the loading condition changes;
- the card props are replaced.

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import TootCard from './TootCard.vue';
import ModalView from '../Modals/ModalView.vue';
import DeleteConfirmModal from '../Modals/DeleteConfirmModal.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import type { MastodonStatus } from '../../types/mastodon';

const PREVIEW_MAX_LENGTH = 120;

const store = useScheduledTootsStore();

/** The list heading: focus lands here once a deleted toot's card is gone. */
const listSummary = ref<HTMLElement | null>(null);

/** The toot pending deletion, or null when no confirmation is open. */
const tootToDelete = ref<MastodonStatus | null>(null);

/** Truncated preview text shown inside the confirmation modal. */
const tootDeletePreview = ref('');

/**
 * Opens the delete confirmation modal for the given toot ID.
 * @param {string} id - The ID of the toot to delete.
 */
function handleDeleteRequest(id: string) {
  const toot = store.toots.find(t => t.id === id);
  if (!toot) return;
  tootToDelete.value = toot;
  const text = toot.params?.text ?? '';
  tootDeletePreview.value = text.length > PREVIEW_MAX_LENGTH
    ? text.slice(0, PREVIEW_MAX_LENGTH) + '…'
    : text;
}

/**
 * Cancels the pending deletion and closes the confirmation modal.
 */
function handleDeleteCancel() {
  tootToDelete.value = null;
  tootDeletePreview.value = '';
}

/**
 * Confirms the deletion of the pending toot. Only its card shows progress meanwhile.
 */
async function handleDeleteConfirm() {
  if (!tootToDelete.value) return;
  const id = tootToDelete.value.id;
  handleDeleteCancel();

  // The focused Delete button disappears with its card: keep keyboard focus in the list.
  if (await store.deleteToot(id)) listSummary.value?.focus();
}

/**
 * Loads a toot into the composer, then scrolls to and focuses its text.
 * @param {string} id - The ID of the toot to edit.
 */
function handleEdit(id: string) {
  const toot = store.toots.find(t => t.id === id);
  if (toot) {
    store.setEditingToot(toot);

    // After a short delay, so the composer has rendered the toot.
    setTimeout(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>('.content-area textarea');
      textarea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textarea?.focus({ preventScroll: true });
    }, 100);
  }
}

onMounted(() => {
  store.fetchScheduledToots();
});
</script>

<template>
  <div class="scheduled-toots">
    <details
      class="toots-details"
      :open="store.count > 0 || !!store.error"
    >
      <summary
        ref="listSummary"
        class="toots-summary"
      >
        <h2>Scheduled Toots ({{ store.count }})</h2>
      </summary>
      
      <div
        v-if="store.isLoading && store.count === 0"
        class="loading"
      >
        Loading scheduled toots...
      </div>
      
      <div
        v-else-if="store.error"
        class="error"
        role="alert"
      >
        {{ store.error }}
      </div>
      
      <div
        v-else-if="store.count === 0"
        class="empty-state"
      >
        No scheduled toots yet.
      </div>
      
      <div
        v-else
        class="toots-list"
      >
        <TransitionGroup 
          name="toot-list" 
          tag="div"
          class="toots-list"
        >
          <TootCard
            v-for="toot in store.sortedToots"
            :id="toot.id"
            :key="toot.id"
            :scheduled-at="toot.scheduled_at || ''"
            :text="toot.params?.text"
            :visibility="toot.params?.visibility"
            :language="toot.params?.language"
            :spoiler_text="toot.params?.spoiler_text"
            :sensitive="toot.params?.sensitive"
            :poll="toot.params?.poll"
            :medias="toot.media_attachments"
            :pending-action="store.pendingId === toot.id ? store.pendingAction : null"
            @edit="handleEdit"
            @delete="handleDeleteRequest"
          />
        </TransitionGroup>
      </div>
    </details>
  </div>

  <ModalView
    :is-open="!!tootToDelete"
    labelled-by="delete-title"
    @close="handleDeleteCancel"
  >
    <DeleteConfirmModal
      :toot-preview="tootDeletePreview"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </ModalView>
</template>
```

- [ ] **Step 6: Verify**

```bash
npx vitest run src/components/Toot src/stores/scheduledToots.test.ts
grep -rn "onDelete\|onEdit\|is-loading\|id=\"sensitive\"" src   # → no output
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected: `Tests  32 passed (32)`, no grep output, `exit=0`, `0 errors`, `Tests  246 passed (246)`.

- [ ] **Step 7: Commit**

```bash
git add src/stores/scheduledToots.ts src/stores/scheduledToots.test.ts src/components/Toot/TootCard.vue src/components/Toot/TootCard.test.ts src/components/Toot/ScheduledToots.vue src/components/Toot/ScheduledToots.test.ts
git commit -m "fix(toots): unique warning toggles, emitted events, progress only on the toot concerned

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/stores/scheduledToots.ts", "src/stores/scheduledToots.test.ts", "src/components/Toot/TootCard.vue", "src/components/Toot/TootCard.test.ts", "src/components/Toot/ScheduledToots.vue", "src/components/Toot/ScheduledToots.test.ts"], "verifyCommand": "npx vitest run src/components/Toot src/stores/scheduledToots.test.ts", "acceptanceCriteria": ["unique sensitive-<id> ids, redundant @click removed", "edit/delete emitted", "pendingId/pendingAction in the store, deleteToot", "progress label only on the pending card", "list kept while refreshing", "focus after delete and edit", "246 tests"], "requiresUserVerification": false}
```

---

### Task 7: Show the time zone in the composer and on the cards (WEB-07)

**Goal:** The time zone the date and time are read in (the browser's, `Intl.DateTimeFormat().resolvedOptions().timeZone`) is shown under the date and time fields, which point to it with `aria-describedby`, and next to each card's date. The helper is a small, tested function.

**Files:**
- Create: `src/utils/timeZone.ts`
- Create: `src/utils/timeZone.test.ts`
- Modify: `src/components/ControlsBar.vue`
- Test: `src/components/ControlsBar.test.ts` (one new test)
- Modify: `src/components/Toot/TootCard.vue`
- Test: `src/components/Toot/TootCard.test.ts` (one new test)

**Acceptance Criteria:**
- [ ] `getTimeZone()` returns the browser's IANA zone, for example `Europe/Stockholm`. When the browser gives none or `Intl` throws, it returns `your local time zone`
- [ ] The composer shows `Time zone: <zone>` under the date and time row (`.time-zone-hint`: 0.9rem, `#666`, full row). `#scheduled-date` and `#scheduled-time` have `aria-describedby="time-zone-hint"`
- [ ] Each card shows `Scheduled for: Jan 1, 2031 12:00 Europe/Stockholm`
- [ ] typecheck and lint (0 errors) pass; `npm test` passes with 250 tests

**Verify:** `npx vitest run src/utils/timeZone.test.ts src/components/ControlsBar.test.ts src/components/Toot/TootCard.test.ts` → `Tests  11 passed (11)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Create `src/utils/timeZone.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTimeZone, UNKNOWN_TIME_ZONE } from './timeZone';

function browserTimeZone(timeZone: string | undefined): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }),
  } as unknown as Intl.DateTimeFormat);
}

describe('getTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the browser's time zone", () => {
    browserTimeZone('Europe/Stockholm');
    expect(getTimeZone()).toBe('Europe/Stockholm');
  });

  it('says "local time zone" when the browser does not tell', () => {
    browserTimeZone(undefined);
    expect(getTimeZone()).toBe(UNKNOWN_TIME_ZONE);

    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new RangeError('Unsupported'); });
    expect(getTimeZone()).toBe(UNKNOWN_TIME_ZONE);
  });
});
```

2. `src/components/ControlsBar.test.ts`:
   - right after `import ControlsBar from './ControlsBar.vue';`, add `import { getTimeZone } from '../utils/timeZone';`;
   - add this test at the end of the `describe` block, before its closing `});`:

```ts

  it('names the time zone the date and time are read in', () => {
    const wrapper = mount(ControlsBar, { props: baseProps });

    expect(wrapper.find('#time-zone-hint').text()).toBe(`Time zone: ${getTimeZone()}`);
    expect(wrapper.find('#scheduled-date').attributes('aria-describedby')).toBe('time-zone-hint');
    expect(wrapper.find('#scheduled-time').attributes('aria-describedby')).toBe('time-zone-hint');
  });
```

3. `src/components/Toot/TootCard.test.ts`:
   - right after `import TootCard from './TootCard.vue';`, add `import { getTimeZone } from '../../utils/timeZone';`;
   - add this test at the end of the `describe` block, before its closing `});`:

```ts

  it('names the time zone of the scheduled date', () => {
    expect(mountCard().find('.meta-label').text()).toContain(getTimeZone());
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/utils/timeZone.test.ts src/components/ControlsBar.test.ts src/components/Toot/TootCard.test.ts`

Expected: FAIL.
- All three files fail to import `../utils/timeZone`, which does not exist yet. Vitest reports `Failed to resolve import`.

- [ ] **Step 3: Create `src/utils/timeZone.ts`**

```ts
/** Shown when the browser does not say which time zone it uses. */
export const UNKNOWN_TIME_ZONE = 'your local time zone';

/**
 * The browser's time zone, in which the composer reads the date and time and the list shows them.
 * @returns {string} An IANA name such as "Europe/Stockholm", or UNKNOWN_TIME_ZONE.
 */
export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || UNKNOWN_TIME_ZONE;
  } catch {
    return UNKNOWN_TIME_ZONE;
  }
}
```

- [ ] **Step 4: Show it in `src/components/ControlsBar.vue`**

1. Right after `import type { ScheduledToot } from '../types/mastodon';`, add `import { getTimeZone } from '../utils/timeZone';`.
2. Right before `const minDateTime = computed(() => {`, add:

```ts
/** The date and time fields are read in the browser's time zone: say which one. */
const timeZone = getTimeZone();

```

3. On `#scheduled-date`, add `aria-describedby="time-zone-hint"` right after `:min="minDateTime.split('T')[0]"`. On `#scheduled-time`, add the same attribute right after `:value="scheduledTime"`.
4. Inside `.controls-bar`, after the language `.form-group`, so as its last child and right before the `</div>` that precedes `<div class="form-actions">`, add:

```html
    <p
      id="time-zone-hint"
      class="time-zone-hint"
    >
      Time zone: {{ timeZone }}
    </p>
```

5. In `<style scoped>`, right after the `input#scheduled-date, input#scheduled-time, ...` rule, add:

```css

.time-zone-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}
```

`flex-basis: 100%` puts the hint on its own line under the fields, on desktop and on mobile.

- [ ] **Step 5: Show it on the cards in `src/components/Toot/TootCard.vue`**

1. Right after `import type { PendingAction } from '../../stores/scheduledToots';`, add `import { getTimeZone } from '../../utils/timeZone';`.
2. Right before `function formatDateTime(date: string) {`, add:

```ts
/** Dates are shown in the browser's time zone, named next to them. */
const timeZone = getTimeZone();

```

3. Replace `          {{ formatDateTime(props.scheduledAt) }}` with `          {{ formatDateTime(props.scheduledAt) }} {{ timeZone }}`.

- [ ] **Step 6: Verify**

```bash
npx vitest run src/utils/timeZone.test.ts src/components/ControlsBar.test.ts src/components/Toot/TootCard.test.ts
npm run typecheck; echo "exit=$?"
npm run lint
npm test
```

Expected: `Tests  11 passed (11)`, `exit=0`, `0 errors`, `Tests  250 passed (250)`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/timeZone.ts src/utils/timeZone.test.ts src/components/ControlsBar.vue src/components/ControlsBar.test.ts src/components/Toot/TootCard.vue src/components/Toot/TootCard.test.ts
git commit -m "feat(schedule): show the time zone under the date and time and on every card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/timeZone.ts", "src/utils/timeZone.test.ts", "src/components/ControlsBar.vue", "src/components/ControlsBar.test.ts", "src/components/Toot/TootCard.vue", "src/components/Toot/TootCard.test.ts"], "verifyCommand": "npx vitest run src/utils/timeZone.test.ts src/components/ControlsBar.test.ts src/components/Toot/TootCard.test.ts", "acceptanceCriteria": ["getTimeZone with fallback", "hint under date/time, described by", "zone on each card", "250 tests"], "requiresUserVerification": false}
```

---

### Task 8: Release 0.16.0

**Goal:** Version 0.16.0 (MINOR: instance limits and the time zone are new user-visible features), with "What's New" entries and the README feature list.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/stores/features.ts`
- Modify: `README.md` (Features list)

**Acceptance Criteria:**
- [ ] The version is `0.16.0` in `package.json`, `package-lock.json` and the first FeatureGroup, dated `2026-10-06`
- [ ] The 4 new ids are unique; each title starts with an emoji and is at most 60 characters; each description is plain text, at most 3 sentences
- [ ] No existing FeatureGroup is changed
- [ ] The README Features list mentions the instance limits, keyboard and screen reader use, and the time zone
- [ ] lint (0 errors), typecheck, test (250) and build pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.16.0`

**Steps:**

- [ ] **Step 1:** Read `.claude/skills/changelog/SKILL.md`.
- [ ] **Step 2:** Run `npm version minor --no-git-tag-version`. Expected output: `v0.16.0`.
- [ ] **Step 3:** Run `grep -nE "instance-limits|keyboard-and-screen-readers|time-zone-shown|per-toot-progress" src/stores/features.ts`. Expected: no output.
- [ ] **Step 4:** Prepend this group at the top of the `features` array (before `version: '0.15.0'`):

```ts
    {
      version: '0.16.0',
      date: '2026-10-06',
      features: [
        {
          id: 'instance-limits',
          title: '📏 Your Instance, Your Limits',
          description: 'The composer now follows your instance\'s own limits: toot length, number of images, image size and image types. If your instance allows 1000 characters, so does Toot Scheduler.'
        },
        {
          id: 'keyboard-and-screen-readers',
          title: '♿ Better With a Keyboard and a Screen Reader',
          description: 'Dialogs, the mobile menu and the composer now work fully with the keyboard: Escape closes them and focus goes back where you were. Screen readers hear errors right away, and a warning as you get close to the character limit.'
        },
        {
          id: 'time-zone-shown',
          title: '🕒 Time Zone Shown',
          description: 'The time zone your toots are scheduled in is now shown under the date and time fields and on every scheduled toot.'
        },
        {
          id: 'per-toot-progress',
          title: '🐛 Fix: The Right Toot, Every Time',
          description: 'Revealing a toot behind a content warning no longer reveals the first one in the list instead, and "Deleting…" now only shows on the toot being deleted.'
        },
      ],
    },
```

- [ ] **Step 5:** In `README.md` → `## Features`, replace `- 🎯 Real-time validation` with:

```markdown
- 🎯 Real-time validation, following your instance's own limits (toot length, images per toot, image size and types)
- ♿ Usable with the keyboard alone and with a screen reader
- 🕒 Shows the time zone your toots are scheduled in
```

- [ ] **Step 6:** Run `npm run lint && npm run typecheck && npm test && npm run build`. Expected: `0 errors`, `Tests  250 passed (250)`, `✓ built`. The `spa-redirect.js` "can't be bundled" warning from Lot 3 is expected.
- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts README.md
git commit -m "chore(release): 0.16.0 — instance limits, keyboard and screen reader access, time zone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts", "README.md"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.16.0 everywhere", "4 unique ids following the changelog rules", "append-only changelog", "README features updated", "lint, typecheck, test, build pass"], "requiresUserVerification": false}
```

---

### Task 9: End-to-end verification by the controller; report to the user

**Goal:**
The controller, not a subagent, extends its Playwright suite and runs it on the production build against the mocked instance. The run covers:
- the 24 Lot 2 and Lot 3 checks, as a regression;
- the Lot 4 checks: a keyboard-only journey, axe-core scans, the instance limits and their fallback, unique ids, the time zone and the live region;
- the CSP-violation listener, over every flow.

The controller then reports what passed and what only the user can check, and asks.

**Files:**
- None in the repo. The suite is in the session scratchpad, `e2e/e2e.mjs`, with `axe-core` installed next to it (`e2e/node_modules`), not in the project

**Acceptance Criteria:**
- [ ] `npm run build`, then `npx vite preview --port 4173 --strictPort`, then `node e2e.mjs`: all checks pass:
  - the 24 existing checks (#1–#16, L3-1–L3-8);
  - L4-1 to L4-14 below, and L4-15 in WebKit only;
  - L3-8, zero CSP violations, now also covering every Lot 4 flow and the axe injection
- [ ] The user has been told what the run proves and what still needs a real instance, a screen reader and Lighthouse, and has answered

**Verify:** the whole suite runs twice, in Chromium and in WebKit (Playwright `webkit`). The Chromium run ends with `38/38 passed` and the WebKit run with `39/39 passed`

**Steps:**

- [ ] **Step 1: Prepare the suite** (in the scratchpad `e2e/` folder, never in the repo)

1. **Mock `/api/v2/instance`.** The mock instance answers `404 { error: 'Not found' }` for any path it doesn't know. Today `/api/v2/instance` is therefore a 404, and the 24 existing checks keep running on the **fallback** limits; that is intended and covers the fallback path. Add to `createInstance()`:
   - `instanceConfig: null` and `instanceFails: false` in `state`;
   - before the final 404:

```js
    if (url.pathname === '/api/v2/instance' && method === 'GET') {
      if (state.instanceFails) return json(500, { error: 'Internal server error' });
      return state.instanceConfig ? json(200, state.instanceConfig) : json(404, { error: 'Not found' });
    }
```

2. **axe-core.** Run `npm i axe-core` in the scratchpad `e2e/` folder. This adds no dependency to the project. Inject it with `page.evaluate`:

```js
import { readFileSync } from 'node:fs';
const AXE = readFileSync(new URL('./node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

async function axeScan(page, name) {
  await page.evaluate(AXE); // through the DevTools protocol: the page's CSP does not apply
  const { violations } = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  const blocking = violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  for (const v of violations) console.log(`  axe ${name}: [${v.impact}] ${v.id} ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`);
  return blocking;
}
```

   Don't use `page.addScriptTag`: it inserts a `<script>` element, which `script-src 'self'` blocks and which would fail L3-8. With `page.evaluate`, `bypassCSP` isn't needed, so the CSP listener stays on for every flow. It was dry-run this way on this plan's build: 12 scans, 0 CSP violations. If an evaluate injection ever fails, fall back to a separate context with `bypassCSP: true`, used **only** for axe scans and left out of the L3-8 count. `@axe-core/playwright` injects the same way, if you prefer it.

3. **Viewports and time zone.** `newContext` uses 1280×900. Use `page.setViewportSize({ width: 390, height: 844 })` for the burger checks. For L4-8, create the context with `timezoneId: 'Asia/Tokyo'` so the expected zone is known.

- [ ] **Step 2: Add the Lot 4 checks**

| Id | Check | Pass when |
|---|---|---|
| L4-1 | Keyboard-only journey, `page.keyboard` only, no clicks:<br>1. Tab to "Get started", Enter.<br>2. Type the instance, Enter.<br>3. On the composer: type the text; Tab to the date and time and type them; Tab to "Schedule", Enter.<br>4. Tab to the new card's "Edit", Enter; change the text; submit.<br>5. Tab to "Delete", Enter; Escape.<br>6. Delete again, Tab to the dialog's "Delete", Enter. | Step 1: the login dialog opens with focus in `#instance`.<br>Step 3: the toot is listed.<br>Step 4: focus is in the textarea with the toot's text, and the update is listed.<br>Step 5: the dialog opens with focus on "Cancel"; after Escape it is closed and focus is back on that card's "Delete".<br>Step 6: the card is gone and focus is on the list toggle, `#scheduled-toots-title button`. |
| L4-2 | Dialog names: login, delete, Thanks, What's New, alt text | Each `[role=dialog]`'s `aria-labelledby` resolves to a visible heading or label with the expected text. The close button's accessible name is "Close". |
| L4-3 | Mobile menu at 390×844 | 1. The burger is named "Menu", with `aria-expanded="false"`.<br>2. Tab from the burger while closed never focuses "Logout".<br>3. Enter sets `aria-expanded="true"`.<br>4. Escape closes it and focuses the burger.<br>5. Thanks from the menu, then Escape, gives focus back to the burger. |
| L4-4 | axe scans: landing; login dialog; login error; composer; composer with an image attached and 470 characters typed; edit mode; composer error; the delete, Thanks and What's New dialogs; mobile menu open; mobile right after load (the "What's New" bubble visible) | 0 `serious` and 0 `critical` violations everywhere; print any `moderate`/`minor` in the report. The dry run found none at all. Scan while no toast is shown (see residuals). |
| L4-5 | Mocked limits: `instanceConfig = { configuration: { statuses: { max_characters: 1000, max_media_attachments: 2 }, media_attachments: { image_size_limit: 2097152, supported_mime_types: ['image/png', 'video/mp4'] } } }`, then sign in | The textarea has no `maxlength` and the counter shows 1000.<br>The hint is `Up to 2 images, max 2 MB each (PNG)` and `accept` is `image/png,.png`.<br>A dropped JPEG, then 3 PNGs, are each refused with **no** `/api/v2/media` call.<br>A 600-character toot is scheduled. |
| L4-6 | Fallback: `instanceFails = true` (500 on v2), then sign in. The mock's `/api/v1/instance` answers 404 | The app asks `/api/v2/instance`, then `/api/v1/instance`, then uses the defaults: the counter shows 500 and is never red, a 600-character toot is not refused by the composer, the textarea has no `maxlength`, and the default hint is `Up to 4 images, max 8 MB each (JPEG, PNG, GIF, WebP, AVIF or HEIC)`. The composer schedules a short toot.<br>After sign-out and sign-in as account B with `instanceConfig` set, the new limits apply: no stale limits across accounts. |
| L4-7 | Two sensitive toots: give account A two scheduled toots, `s1` and a new `s2`, both with `sensitive: true` and a `spoiler_text` | The ids `sensitive-s1` and `sensitive-s2` are distinct, each `label[for]` matches its own input, and clicking the second label unblurs only the second card. |
| L4-8 | Time zone, context `timezoneId: 'Asia/Tokyo'` | The hint is `Time zone: Asia/Tokyo`, each card's date ends with `(Asia/Tokyo)`, and scheduling 2031-02-01 12:00 posts `scheduled_at` `2031-02-01T03:00:00.000Z`. |
| L4-9 | Live region: mock `instanceConfig = { configuration: { statuses: { max_characters: 500 } } }`, sign in, fill 455 characters, then 456 | `[aria-live="polite"]` reads `45 characters left` and does not change at 456. With the fallback (L4-6) it stays empty. Every error shown in L4-1, L4-5 and L4-6 has `role="alert"`. |
| L4-10 | v1 fallback: `/api/v2/instance` answers 404; add `instanceV1Config` to the mock, served at `/api/v1/instance`, set to `{ max_toot_chars: 5000 }` (Pleroma/Akkoma style), then sign in | Both endpoints are called, in that order; the counter shows 5000, and a 600-character toot is scheduled. |
| L4-11 | Layout at 1280×900, signed in; then at 390×844 | Desktop: the top of `.user-info` is below the bottom of the fixed `.header` (bounding boxes), so nothing is hidden under it. Mobile: the screenshot matches the pre-Lot-4 layout. |
| L4-12 | What's New: open it from the header (desktop) with new features listed | The dialog has focus, its `scrollTop` is 0 and its heading `#whats-new-title` is within the dialog's visible area. Tab moves focus to "Got it!". |
| L4-13 | Create in flight: account A with two scheduled toots; hold the mock's `POST /api/v1/statuses` answer, then submit a new toot | While the POST is pending, every card's Edit and Delete is `disabled` and no card says "Deleting…" or "Updating…". Once it answers, the new toot is listed and the buttons are enabled again. |
| L4-14 | v1 merge: `instanceConfig = { configuration: { statuses: { max_media_attachments: 2 } } }` (no `max_characters`) and `instanceV1Config = { max_toot_chars: 5000 }`, then sign in | Both endpoints are called; the counter shows 5000 and the upload hint says `Up to 2 images`. |
| L4-15 (WebKit) | Safari behaviour, in the WebKit run only: click (not keyboard) the openers of the delete, Thanks and What's New dialogs, then close each; click the burger; open a dialog while recording when focus enters it (a `focusin` listener and `requestAnimationFrame` timestamps from the moment `[role=dialog]` is inserted); trigger a login error, a composer error, an upload error and a list error | 1. After each close, focus is back on the clicked opener, or on What's New's `returnFocus` target ("Say Thanks", the burger or `main h1`) when its button is gone.<br>2. The burger is the active element after the click, and its `aria-expanded` changes.<br>3. Focus enters the dialog at least one animation frame after the dialog is inserted.<br>4. Each `[role=alert]` container (login, composer, upload, list) is in the DOM, empty, before the error, and is the same element once filled. |

Then make L3-8 also cover the L4 flows. Run the whole suite in Chromium and in WebKit. Expected end of run: `38/38 passed` in Chromium and `39/39 passed` in WebKit (L4-15 runs in WebKit only).

- [ ] **Step 3: Run**

```bash
npm run build
npx vite preview --port 4173 --strictPort &   # in the repo
node e2e.mjs                                  # in the scratchpad e2e/ folder
```

Look at the screenshots in `e2e/shots/`, including the landing hero, the composer, the mobile menu and each dialog, to confirm the layout is unchanged:
- the `<main>` move;
- the closed mobile menu, now `visibility: hidden`;
- the new button and error colors.

- [ ] **Step 4: Report to the user**

Only the user can check these:
1. **Real instance limits:** sign in to a real instance that allows more than 500 characters. Check that the counter starts at its limit, that a toot longer than 500 characters schedules, and that the upload hint shows its image size and types. Optionally, on a pre-4.0 or non-Mastodon instance, check that the defaults apply quietly.
2. **VoiceOver pass** (macOS, Safari):
   - the login dialog is announced by its name, and an error is read at once;
   - the media and poll toggles are announced with their names;
   - the counter speaks near the limit only;
   - the burger says "Menu, collapsed/expanded";
   - the delete dialog is named and focus comes back after it;
   - the time zone is read with the date and time fields.
3. **Lighthouse accessibility ≥ 95** on the preview build or the deployed site, for the landing page and for the signed-in composer (Chrome DevTools → Lighthouse → Accessibility).

**User Verification Required:**
Before marking this task complete, you MUST call AskUserQuestion:
```yaml
AskUserQuestion:
  question: "The automated checks pass (keyboard journey, axe with no serious or critical violation, instance limits and fallback, unique ids, time zone, no CSP violation). Do the real-world checks pass: limits on a real instance allowing more than 500 characters, a VoiceOver pass, and Lighthouse accessibility of at least 95?"
  header: "Verification"
  options:
    - label: "All checks pass"
      description: "Lot 4 is validated: close and publish the PR"
    - label: "A check fails"
      description: "Tell me which one and what you saw; back to fixing, then re-verification"
    - label: "Publish, check later"
      description: "Publish the PR now, with the real-world checks left unchecked in its test plan"
```

```json:metadata
{"files": [], "verifyCommand": "node e2e.mjs", "acceptanceCriteria": ["24 existing checks still pass", "L4-1..L4-14 pass in Chromium and WebKit, L4-15 in WebKit (keyboard journey, axe serious/critical = 0, limits, v1 fallback and merge, unique ids, time zone, live region, layout, What's New at the top, cards disabled during a create, Safari focus and alerts): 38/38 Chromium, 39/39 WebKit", "zero CSP violations across all flows", "user informed of real-instance, VoiceOver and Lighthouse checks and answered"], "requiresUserVerification": true, "userVerificationPrompt": "The automated checks pass (keyboard journey, axe with no serious or critical violation, instance limits and fallback, unique ids, time zone, no CSP violation). Do the real-world checks pass: limits on a real instance allowing more than 500 characters, a VoiceOver pass, and Lighthouse accessibility of at least 95?"}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. Push `fix/lot-4-a11y-instance-limits` and open the PR against `fix/lot-3-defense-in-depth`, or against `main` if Lot 3 has been merged. The PR test plan lists the Task 9 checks and the three user checks.

## Self-review notes

- **Spec coverage (Lot 4):**
  - `ModalView`, Task 3:
    - `labelledBy` → `aria-labelledby`, close button `aria-label="Close"`;
    - focus restored only after a real opening; Escape closes;
    - dead `<slot @close-child-modal>` removed; `close` unified (LoginForm, LandingPage, WhatsNew); a heading id on every usage;
    - document-level Tab trap, top-most Escape via `openStack`, scroll lock, `initialFocus` (What's New opens on the dialog itself).
  - Burger, Task 5: `aria-label`, `aria-expanded`, `aria-controls`, Escape.
  - Page structure, Task 5: one `<h1>` per view and `<main>` around `RouterView`. The only `<main>` is App's: LandingPage's own is removed, and a grep plus `App.test.ts` and `LandingPage.test.ts` check it.
  - `TootCard`, Task 6:
    - `sensitive-${id}` ids; the redundant `@click` removed;
    - `emit('edit' | 'delete')`;
    - `pendingId` (and `pendingAction`) in the store instead of the global `isLoading`;
    - `busy` prop, a single pending slot shared with `createToot`, and `BusyError` for a refused change.
  - Counter `aria-live="polite"`, `role="alert"` on errors, media and poll labels (visually hidden), `.visually-hidden` utility → Task 4.
  - `instance` store → Task 1:
    - `/api/v2/instance` after login and after session restore, zod with `parseApiResponse`;
    - the four limits, each with its default (500, 4, 8 MB, Lot 3 types) when missing or invalid; per-limit flags `hasCharacterLimit` / `hasMediaLimit`, so a default is never enforced as the instance's own;
    - `/api/v1/instance` as the fallback when v2 fails (not on a 401), and merged when v2 gives no `max_characters`;
    - reset on sign-out and account switch.
  - Store wiring → Task 2:
    - ContentArea and the composer check;
    - MediaUpload and `media.ts`: count, size, types (instance images ∩ Lot 3 list, extension guess kept), derived `accept`, hint;
    - `getImageRejection` pure, with its tests kept.
  - Time zone under the date and time fields and on the cards, with a testable helper → Task 7.
  - CC-10 ("Editing…"/"Deleting…" on every card) → Task 6. BUG-09 (dead wiring) → Task 3.
  - Release 0.16.0, What's New and README → Task 8. Controller verification → Task 9.
  - Spec tests:
    - ModalView (Escape closes; initial focus on the first focusable; no refocus when never opened, nor after close plus unmount) → Task 3;
    - two TootCards have distinct ids → Task 6;
    - ContentArea follows the store's `maxCharacters` → Task 2;
    - the instance store falls back when the API fails → Task 1.
  - Spec acceptance (keyboard journey; axe with no serious or critical violation; Lighthouse ≥ 95) → Task 9 (L4-1, L4-4) and the user checks.
- **Deviations (justified):**
  - **Contrast fixes added to Task 4.** They were not in the spec, but its own acceptance criterion (axe with no serious or critical violation, Lighthouse ≥ 95) cannot pass without them. The dry run flagged:
    - error text;
    - the near-limit counter;
    - the "Alt" and remove-image buttons;
    - the Delete dialog button and the Thanks dialog Cancel;
    - the edit-mode Update button;
    - the mobile "What's New" bubble (Task 5).

    Only palette values already in the code are used, and hovers use `filter: brightness()`. The `ui-design-system` skill is updated so future UI doesn't bring the failing pairs back: its listed error `#e74c3c`, edit `#2b90d9` and white-on-neutral all failed AA.
  - **`supportedMimeTypes` holds the usable image types** (the instance's list kept to Lot 3's images, non-string entries dropped), never the raw list, and it is never empty. A list with no supported image is treated as invalid and gives the default list; the instance still checks every upload.
  - **When it loads:** the store watches `auth.accessToken`, so neither `OAuthCallback` nor the auth store had to change. Sign-in, a restored session, a cross-tab account switch and sign-out are all covered by one watcher, and an answer for an old session is ignored. App.vue creates the store.
  - **`/api/v1/instance` fallback (added in review).** When v2 fails with anything but a 401, the limits are read from v1: Mastodon 3.4.2+ `configuration`, or Pleroma/Akkoma's top-level `max_toot_chars`. When v2 answers without `max_characters`, v1 is asked too, and its text limit is merged, with v2's other values kept. If that v1 call fails, v2's answer stands. Both endpoints are reduced to the same limits by `InstanceSchema` / `InstanceV1Schema`. A 401 on v2 is not retried: it ends the session as everywhere else. A 401 on the merge's v1 call is caught there, but the shared client (Lot 2) has already ended the session.
  - **Per-limit gating: `hasCharacterLimit` and `hasMediaLimit` (added in review).** Each flag is true only when the instance actually gave that limit. Until then the default is a guess and is not enforced:
    - without a text limit, the composer does not refuse a long toot, the counter is never red and the live region stays silent;
    - without an image limit, the submit check does not refuse the image count.

    The instance remains the judge, and its 422 message is shown.
  - **Mastodon-style counting, no `maxlength` (added in review).** `src/utils/tootLength.ts` counts as Mastodon's StatusLengthValidator does: each URL is 23 characters, `@user@domain` counts as `@user`, and the rest is counted in graphemes (`Intl.Segmenter`, code points without it). The content warning is counted when it is enabled, trimmed, in the counter and in the submit check alike. The textarea has no `maxlength`: a cap counted in UTF-16 units would truncate text Mastodon accepts (long URLs, emoji), so the counter goes negative and the submit check explains instead.
  - **Image size fallback stays 8 MB** (Lot 3), although Mastodon 4.x defaults to 16 MB: only the instance's own value raises it.
  - **`ModalView` beyond the plan (review fixes):**
    - its close button moved after the slot in the DOM; its position on screen is unchanged. So "first focusable" is the dialog's own content: the instance field in the login dialog, Cancel in the Delete and Thanks dialogs, and the description field in the alt-text dialog;
    - `labelledBy` is required, so a dialog without a name fails typecheck;
    - `initialFocus: 'first' | 'dialog'` (default `'first'`). What's New uses `'dialog'`: its only control, "Got it!", is at the end of long content, so the dialog itself takes focus and opens scrolled to the top. Tab from there goes to the first control;
    - a document-level keydown handler, active only while the dialog is open: Tab and Shift+Tab wrap inside it and bring focus back when it fell out (onto `<body>`, say). Escape is ignored during IME composition;
    - a module-level `openStack`: only the top-most dialog reacts to Escape and Tab;
    - a `body.modal-open` class locks page scroll while any dialog is open;
    - the opener is captured synchronously when `isOpen` turns true, before the content can take focus. Focus goes back to it on close or unmount, only if it is still in the page;
    - a dialog closed or unmounted before it activated leaves no trace;
    - What's New closed by Escape, the overlay or the close button counts as seen.
  - **Headings and layout:** the header's "Toot Scheduler" is a `<p>` on every route. The spec allowed `<p>` or `<h1>` depending on the route; one rule is simpler. The composer gets a visually hidden `<h1>Schedule a toot</h1>`, OAuthCallback's "Authenticating..." becomes its `<h1>`, and the landing `<h1>` has `tabindex="-1"` so focus lands there after logout. `.app-main` is a flex column, so the routed pages stay flex items as they were directly under `.app`, and their top margins don't collapse (the composer no longer slides under the fixed header).
  - **Scheduled list: an accordion instead of `<details>` (added in review).** The `<summary>` with an `<h1>` inside became an `<h2>` holding a real toggle `<button>` (`aria-expanded`, `aria-controls="scheduled-toots-panel"`), with the panel under `v-show`. The list opens by itself when it has toots, and a collapse by hand is remembered. Its error is shown above the panel (see the Safari fixes) and neither opens the panel nor hides the toots.
  - **`MobileNav` extracted from App.vue** (the spec lists App.vue) so it can be tested without mounting the whole app. Beyond the plan:
    - the closed menu gets `visibility: hidden`: otherwise Tab reached its off-screen items;
    - choosing an item closes the menu and focuses the burger first, so a dialog opened from the menu returns focus to a visible element;
    - it closes when focus moves to an element outside it (`focusout` with a target);
    - Escape is left to an open dialog (`body.modal-open`) or to a handler that already handled it, so one press never closes both;
    - desktop and mobile navs are `<nav aria-label="Account">` landmarks;
    - transitions and the bubble animation stop under `prefers-reduced-motion`.
  - **Composer toggles are now controlled** (`showMedia` and `showPoll` props) instead of keeping their own state. The dry run found that they went out of sync after scheduling and when editing a toot with images. The labels say "Add images" and "Add a poll".
  - **Live region strategy:** it speaks only when the remaining count reaches or leaves 50, 20, 10, 0 or −1, with the exact count. Over the limit it says "N characters over the limit", never a minus sign. The visible counter carries hidden text with the same wording, and the textarea is described by it. A repeated composer error is cleared and inserted again on the next tick so it is announced again. LoginForm puts focus back on the instance field after a failed attempt.
  - **One operation at a time (added in review; goes beyond `pendingId`).**
    - Creating, updating and deleting all take the store's single pending slot:
      - `createToot` holds it as `'new'`, so no card shows progress but all are disabled;
      - `updateToot` and `deleteToot` hold it with the toot's id.
    - While it is held, every card's buttons are disabled (`busy` prop). Only the toot concerned says "Deleting…" or "Updating…" and is `aria-busy`.
    - A second change is refused before anything is sent: `createToot` and `updateToot` throw `BusyError`, and `deleteToot` returns `false`. The composer shows the `BusyError` and keeps the form, without reloading the list. A deletion confirmed while busy is not attempted. Edit is ignored while busy.
    - Update and create failures are shown by the composer, not put in the list error, and any failure other than `BusyError` reloads the list.
    - A `fetchSeq` guard lets only the latest list reload write the list and its loading state.
    - Late results from a previous session are ignored, and the pending state is reset on an account switch.
  - **Cards and the composer:**
    - "Editing…" is removed: Edit only loads the toot, nothing is pending.
    - The list stays visible while it refreshes ("Loading…" only when empty).
    - After Edit, the composer's text box (found by `data-toot-text`) gets focus, and the scroll is instant under `prefers-reduced-motion`.
    - After a deletion, focus goes to the list toggle on success, and back to that card's Delete button (found by `data-toot-id`) on failure, unless the user moved it elsewhere meanwhile. The choice follows the outcome, not the DOM: a deleted card stays in the page during its 0.3 s leave transition. The list transitions are off under `prefers-reduced-motion`.
    - When the toot being edited is deleted, the store leaves edit mode. The composer's watcher empties the form whenever edit mode ends outside it, and a `$onAction` hook shows "The toot you were editing was deleted." Cancel and a saved edit show no notice.
    - The sensitive toggle's label has a visually hidden prefix ("Show the content behind this warning:").
  - **Time zone:** shown as the IANA name (for example `Europe/Stockholm`), with no UTC offset, which would change with daylight saving time. It appears as `Time zone: …` under the date and time fields (their `aria-describedby`) and in parentheses after each card's date, `… 14:30 (Europe/Stockholm)`. The helper returns `your local time zone` when the browser gives none.
  - **What's New 0.16.0** has four entries: instance limits, keyboard and screen reader, time zone, and the per-toot fix.
  - **New test files** beyond the spec: `App.test.ts`, `LandingPage.test.ts`, `MobileNav.test.ts`, `ScheduledToots.test.ts`, `ContentArea.test.ts`, `TootCard.test.ts`, `timeZone.test.ts`, `tootLength.test.ts`. The suite ends at **362 tests**, not the 250 planned, because of the review and Safari/VoiceOver fixes.
  - **Task 9 follows what shipped:**
    - L4-1: focus after the deletion goes to `#scheduled-toots-title button`.
    - L4-5 and L4-6: check the counter, not `maxlength`. The fallback goes through `/api/v1/instance` before the defaults.
    - L4-8: the card's date ends with `(Asia/Tokyo)`.
    - L4-9: run it with `max_characters: 500` mocked, since an unknown limit keeps the live region silent.
    - L4-10 to L4-14 are added for the review fixes: the v1 fallback, the desktop layout, What's New opening at the top, cards disabled during a create, and the v1 merge.
    - L4-15 (WebKit only) covers the Safari fixes. The suite runs in Chromium and WebKit: `38/38 passed` and `39/39 passed`.
  - **Safari/VoiceOver fixes (after the user's VoiceOver pass).** The markup was already correct; the failures came from timing, which Playwright WebKit reproduced:
    - **Dialog name:** ModalView moves the initial focus one frame and one task after the dialog is rendered (`requestAnimationFrame` then `setTimeout`), so WebKit registers the dialog first and VoiceOver reads "<name>, web dialog". The trap, `openStack` and the scroll lock start at once. The deferred focus is skipped if the dialog was closed, unmounted or covered by another one meanwhile.
    - **Focus return in Safari:** Safari does not focus a clicked button, so ModalView also records the last clicked control (one capture-phase `click` listener on the document, added once) and returns focus there when nothing else had focus at opening. The burger focuses itself on toggle, so its new `aria-expanded` state is announced.
  - **Persistent alerts:** the login form, composer, media upload and scheduled list keep an empty `role="alert"` container in the DOM and only change its content, because Safari ignores an alert inserted already filled. The list's alert sits outside the collapsible panel, whose hidden subtree is not in the accessibility tree. The instance field gets `aria-invalid` and `aria-describedby="login-error"` on error.
  - **Counter announcement:** the live region is `aria-atomic` and speaks a reached step only after a 500 ms typing pause (as in the GOV.UK character count), with the count at that moment, because VoiceOver drops polite updates made while typing. The steps are unchanged, and the timer is cleared on unmount.
  - **Focus return, hardened (after the Safari fixes):**
    - the clicked control stands in for the opener only if it was clicked within the last second, and only once;
    - ModalView gives focus back one tick after closing, so an opener removed by the same update is seen as gone whatever the render order;
    - a `returnFocus` prop names where focus goes when the opener is gone or there was none. What's New uses it, because its desktop button disappears once the features are seen: focus goes to the displayed "Say Thanks", else the burger, else the page's `<h1>` (the composer's visually hidden `<h1>` now has `tabindex="-1"`).
  - **The list keeps its toots under an error:** the error, shown in the persistent alert above the panel, no longer opens the panel, overrides a collapse by hand, or hides the toots. "No scheduled toots yet." is hidden while there is an error, since after a failed load it may be false.
  - **No new project dependency.** axe-core is installed in the scratchpad's e2e folder only.
- **Known residuals:**
  - **Character counting** follows Mastodon's rules (URLs as 23, remote mentions shortened, graphemes, content warning included) with simpler patterns: the URL pattern is `https?://\S+`, so trailing punctuation or scheme-less links may count differently. Without `Intl.Segmenter`, code points are counted. The instance stays the judge, and its 422 message is shown.
  - **Unknown limits are not retried:** when both instance endpoints fail, or give no value, the corresponding flag stays false until the next sign-in or reload. The store's `load()` is never called again.
  - **MediaUpload always checks its defaults** (4 images, 8 MB, the Lot 3 type list) when the instance gives none, while the submit check enforces the image count only when `hasMediaLimit` is true. An instance that allows more images, or larger ones, without saying so is held to the defaults in the upload area.
  - **A deletion refused because another change started while its dialog was open** is not attempted. Focus then returns to the card's disabled Delete button and falls to `<body>`. The UI cannot reach this today: Delete is disabled while busy, and an open dialog blocks the composer.
  - Closing the media section keeps the uploaded images, which are still sent. This predates the lot and differs from the poll, fixed in Lot 1; it is left for a later lot.
  - Dialogs set `aria-modal="true"` and trap Tab, but do not make the rest of the page `inert`. The scroll lock is `overflow: hidden` on `<body>`, which iOS Safari may not honour.
  - The open mobile menu has no focus trap; this is the disclosure pattern, and Escape closes it. A click that gives focus to nothing (non-focusable text, or Safari not focusing buttons) leaves it open.
  - The scheduled list is fetched twice when the composer mounts (by the composer and by the list). `fetchSeq` keeps the result correct; the extra request is left for Lot 5.
  - **Deferred dialog focus:** for about a frame after a dialog opens, focus is still on its opener, so a key pressed in that instant reaches the opener (Tab and Escape are already handled by the dialog). Focus also comes back one tick after a dialog closes, so it rests on `<body>` for that tick.
  - **Verified in WebKit, not yet re-tested with VoiceOver:** the Safari fixes were confirmed in Playwright WebKit (timing and DOM, L4-15). A new VoiceOver + Safari pass is still needed for the dialog names, the alerts, the counter, the burger state and the focus return.
  - Toasts (vue-toastification's default colors, for example white on green) may fail contrast while shown. Task 9 scans while no toast is visible. Restyling the library's toasts is left for Lot 5.
  - Dark mode is not addressed (`prefers-color-scheme` is not handled in these components), as before.
