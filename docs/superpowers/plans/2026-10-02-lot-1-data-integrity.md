# Lot 1 — Data Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scheduled toots are never lost, duplicated or hidden: safe edits, real idempotency, full pagination, and correct poll and language handling.

**Architecture:** The payload building and the "did only the date change?" decision move into pure, unit-tested functions under `src/utils/`. The API composable gains `rescheduleToot` (PUT), a real `Idempotency-Key` header and Link-header pagination restricted to the instance origin. The scheduled-toots store is migrated to the setup-store pattern, and its `updateToot` creates before it deletes. `TootComposer` holds one idempotency key per draft and blocks resubmission while a request is in flight.

**Tech Stack:** Vue 3.5 (`<script setup lang="ts">`), Pinia 2 setup stores, TypeScript 5.7, axios 1.20, date-fns 4, Vitest 4 + @vue/test-utils + happy-dom.

**User Verification:** YES. The spec requires human validation at the end of Lot 1, on a real Mastodon instance: no loss, no duplicate and pagination behavior, which mocked unit tests cannot prove. Task 8 is the gate.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 1 (BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-07, CC-03, CC-06 for this store, plus the deferred `PollParams` item). Decision **D3**: a date-only edit uses `PUT /api/v1/scheduled_statuses/:id`; any other edit creates the new toot first, then deletes the old one.

---

## Context the engineer needs

- **Branch:** `fix/lot-1-data-integrity` is stacked on `chore/lot-0-quality-gate` (PR #38, not merged yet). The PR for this plan targets `chore/lot-0-quality-gate`.
- **Quality commands:** `npm run lint` (must show 0 errors; the warning count only goes down in this lot), `npm run typecheck` (`vue-tsc -b`), `npm test` (Vitest) and `npm run build`. Tests sit next to their source as `*.test.ts`, and each test file imports `describe/it/expect/vi` from `'vitest'` explicitly.
- **npm quirk:** if you ever need `npm install -D`, use `npx -y npm@11 install -D …` (npm 10 crashes with `edgesOut`). This plan adds **no** dependency.
- **Project skills:** read `.claude/skills/vue3-codegen/SKILL.md`, `.claude/skills/mastodon-api/SKILL.md` and `.claude/skills/web-security/SKILL.md` before coding, and `.claude/skills/changelog/SKILL.md` for Task 7.
- **Mastodon facts verified against docs.joinmastodon.org and `config/initializers/cors.rb`:**
  - `GET /api/v1/scheduled_statuses`: `limit` defaults to 20, max 40, paginated with the `Link` header. `Link` is in CORS `expose`, so the browser can read it.
  - `PUT /api/v1/scheduled_statuses/:id`: only `scheduled_at` can change. Returns 422 if the date is less than 5 min ahead.
  - `POST /api/v1/statuses`: the `Idempotency-Key` **header** is kept for 1 hour. CORS allows any header. `poll` and `media_ids` are mutually exclusive.
  - ScheduledStatus `params.*` fields are all **nullable** (`visibility`, `language`, `sensitive`, `spoiler_text`, `media_ids` and `poll` can be `null`).
- **Why each piece exists (audit IDs):**
  - BUG-01: edit = delete then create, so a failed creation lost the toot.
  - BUG-02: the button was never disabled, and `idempotency` was sent in the body, where Mastodon ignores it.
  - BUG-03: only the first 20 toots were shown.
  - BUG-04: a closed poll was still sent.
  - BUG-05: the edit form read `newToot.language`, which does not exist, instead of `params.language`.
  - BUG-07: the poll duration was a string.
- **Every code block below was dry-run on a scratch copy of this branch:** 47 tests pass, typecheck is clean, lint shows 0 errors and 7 warnings, and the build passes.

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/types/mastodon.ts` | Modify | Shared `PollParams` (API) and `PollFormState` (UI) types |
| `src/components/Toot/TootCard.vue` | Modify | `poll` prop accepts the API's `null` |
| `src/utils/buildScheduledToot.ts` (+ `.test.ts`) | Create | Form state → API payload (poll rules) |
| `src/utils/isOnlyScheduleChange.ts` (+ `.test.ts`) | Create | Date-only edit detection, null-safe |
| `src/utils/linkHeader.ts` (+ `.test.ts`) | Create | `rel="next"` extraction, same-origin only |
| `src/composables/useMastodonApi.ts` (+ `.test.ts`) | Modify | Idempotency header, `rescheduleToot`, pagination |
| `.claude/skills/mastodon-api/SKILL.md` | Modify | Correct the `idempotency` guidance |
| `src/stores/scheduledToots.ts` (+ `.test.ts`) | Rewrite | Setup store; create-then-delete `updateToot` |
| `src/components/Toot/PollSection.vue` (+ `.test.ts`) | Modify | `PollFormState` type, numeric duration |
| `src/components/ControlsBar.vue` (+ `.test.ts`) | Modify | `isSubmitting` → disabled button and label |
| `src/components/Toot/TootComposer.vue` (+ `.test.ts`) | Modify | Uses the above; one idempotency key per draft |
| `package.json`, `package-lock.json`, `src/stores/features.ts` | Modify | Release 0.13.2 |

Task order matters: each task leaves `npm run typecheck` green. Tasks 4 and 5 make small **interim** edits to callers, which Task 6 then replaces.

---

### Task 1: Shared poll types and the `buildScheduledToot` payload builder

**Goal:** A pure, tested function turns the composer state into the API payload, and only sends a poll that is open, valid and not combined with media.

**Files:**
- Modify: `src/types/mastodon.ts`
- Modify: `src/components/Toot/TootCard.vue` (import line and `poll` prop)
- Create: `src/utils/buildScheduledToot.ts`
- Test: `src/utils/buildScheduledToot.test.ts`

**Acceptance Criteria:**
- [ ] `PollParams` and `PollFormState` are exported from `src/types/mastodon.ts`, and no inline poll object type remains in that file
- [ ] `MastodonStatus.params.poll` is typed `PollParams | null` (the API returns `null`)
- [ ] `buildScheduledToot` passes the 7 tests below (closed poll ignored, trimmed options, numeric `expires_in`, single option rejected, poll + media rejected)
- [ ] `npm run typecheck` exits 0

**Verify:** `npx vitest run src/utils/buildScheduledToot.test.ts` → `Tests  7 passed (7)`

**Steps:**

- [ ] **Step 1: Write the failing test** — create `src/utils/buildScheduledToot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildScheduledToot, type ComposerForm } from './buildScheduledToot';

function makeForm(overrides: Partial<ComposerForm> = {}): ComposerForm {
  return {
    content: '  Hello world  ',
    scheduledAt: new Date('2030-01-01T12:00:00.000Z'),
    visibility: 'public',
    language: 'fr',
    isSensitive: false,
    spoilerText: '',
    mediaIds: [],
    showPoll: false,
    poll: { options: ['', ''], expiresIn: 86400, multiple: false, hideTotals: false },
    ...overrides,
  };
}

describe('buildScheduledToot', () => {
  it('builds a plain toot with trimmed text and an ISO date', () => {
    expect(buildScheduledToot(makeForm())).toEqual({
      status: 'Hello world',
      scheduled_at: '2030-01-01T12:00:00.000Z',
      visibility: 'public',
      language: 'fr',
      sensitive: false,
      spoiler_text: undefined,
      media_ids: [],
    });
  });

  it('keeps the content warning only when the toot is sensitive', () => {
    expect(buildScheduledToot(makeForm({ isSensitive: true, spoilerText: ' Spoilers ' })).spoiler_text).toBe('Spoilers');
    expect(buildScheduledToot(makeForm({ isSensitive: false, spoilerText: 'Spoilers' })).spoiler_text).toBeUndefined();
  });

  it('ignores poll options when the poll section is closed', () => {
    const toot = buildScheduledToot(makeForm({
      showPoll: false,
      poll: { options: ['Yes', 'No'], expiresIn: 3600, multiple: false, hideTotals: false },
      mediaIds: ['m1'],
    }));
    expect(toot.poll).toBeUndefined();
    expect(toot.media_ids).toEqual(['m1']);
  });

  it('sends an open poll with trimmed, non-empty options and a numeric duration', () => {
    const toot = buildScheduledToot(makeForm({
      showPoll: true,
      poll: { options: [' Yes ', '', 'No'], expiresIn: '3600' as unknown as number, multiple: true, hideTotals: true },
    }));
    expect(toot.poll).toEqual({ options: ['Yes', 'No'], expires_in: 3600, multiple: true, hide_totals: true });
  });

  it('treats an open poll with no options filled in as no poll', () => {
    expect(buildScheduledToot(makeForm({ showPoll: true })).poll).toBeUndefined();
  });

  it('rejects a poll with a single option', () => {
    expect(() => buildScheduledToot(makeForm({
      showPoll: true,
      poll: { options: ['Only one', ''], expiresIn: 3600, multiple: false, hideTotals: false },
    }))).toThrow('A poll needs at least two options.');
  });

  it('rejects a poll combined with media', () => {
    expect(() => buildScheduledToot(makeForm({
      showPoll: true,
      mediaIds: ['m1'],
      poll: { options: ['Yes', 'No'], expiresIn: 3600, multiple: false, hideTotals: false },
    }))).toThrow('A toot cannot have both a poll and media.');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/buildScheduledToot.test.ts`
Expected: FAIL with `Failed to resolve import "./buildScheduledToot"`.

- [ ] **Step 3: Add the shared poll types**

Replace the whole of `src/types/mastodon.ts` with:

```ts
/** Poll parameters as sent to and returned by the Mastodon API. */
export interface PollParams {
  options: string[];
  expires_in: number;
  multiple?: boolean;
  hide_totals?: boolean;
}

/** Poll state as edited in the composer (PollSection v-model). */
export interface PollFormState {
  options: string[];
  expiresIn: number;
  multiple: boolean;
  hideTotals: boolean;
}

export interface MastodonStatus {
  id: string;
  content: string;
  created_at: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  url: string;
  media_attachments: any[];
  scheduled_at?: string;
  spoiler_text?: string;
  language?: string;
  poll?: PollParams;
  params?: {
    text: string;
    media_ids?: string[];
    scheduled_at?: string;
    visibility?: 'public' | 'unlisted' | 'private' | 'direct';
    sensitive?: boolean;
    spoiler_text?: string;
    language?: string;
    poll?: PollParams | null;
  };
  status?: string;
}

export interface MastodonMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio';
  url: string;
  preview_url: string;
  description?: string;
}

export interface MastodonAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  avatar: string;
}

export interface ScheduledToot {
  status: string;
  media_ids?: string[];
  scheduled_at?: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;
  spoiler_text?: string;
  language?: string;
  poll?: PollParams;
} 
```

- [ ] **Step 4: Let `TootCard` accept the API's `null` poll**

In `src/components/Toot/TootCard.vue`, replace `import type { ScheduledToot } from '../../types/mastodon';` with:

```ts
import type { PollParams } from '../../types/mastodon';
```

and replace `  poll?: ScheduledToot['poll'];` with:

```ts
  poll?: PollParams | null;
```

(`TootCard` only checks whether `poll` is truthy, so the template is unchanged. Without this change, `npm run typecheck` fails in `ScheduledToots.vue`, because `toot.params?.poll` can now be `null`.)

- [ ] **Step 5: Write the implementation** — create `src/utils/buildScheduledToot.ts`:

```ts
import type { PollFormState, ScheduledToot } from '../types/mastodon';

/** The composer state needed to build a scheduled toot payload. */
export interface ComposerForm {
  content: string;
  scheduledAt: Date;
  visibility: ScheduledToot['visibility'];
  language: string;
  isSensitive: boolean;
  spoilerText: string;
  mediaIds: string[];
  showPoll: boolean;
  poll: PollFormState;
}

const MIN_POLL_OPTIONS = 2;

/**
 * Builds the Mastodon payload for a scheduled toot from the composer state.
 * The poll is only sent when its section is open and at least one option is filled in.
 * @param {ComposerForm} form - The current composer state.
 * @returns {ScheduledToot} The payload for POST /api/v1/statuses.
 * @throws {Error} If the poll has a single option, or is combined with media.
 */
export function buildScheduledToot(form: ComposerForm): ScheduledToot {
  const spoilerText = form.spoilerText.trim();
  const toot: ScheduledToot = {
    status: form.content.trim(),
    scheduled_at: form.scheduledAt.toISOString(),
    visibility: form.visibility,
    language: form.language,
    sensitive: form.isSensitive,
    spoiler_text: form.isSensitive && spoilerText ? spoilerText : undefined,
    media_ids: form.mediaIds,
  };

  if (!form.showPoll) return toot;

  const options = form.poll.options.map(option => option.trim()).filter(option => option !== '');
  if (options.length === 0) return toot;
  if (options.length < MIN_POLL_OPTIONS) {
    throw new Error('A poll needs at least two options.');
  }
  if (form.mediaIds.length > 0) {
    throw new Error('A toot cannot have both a poll and media.');
  }

  toot.poll = {
    options,
    expires_in: Number(form.poll.expiresIn),
    multiple: form.poll.multiple,
    hide_totals: form.poll.hideTotals,
  };
  return toot;
}
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `npx vitest run src/utils/buildScheduledToot.test.ts` → `Tests  7 passed (7)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`

- [ ] **Step 7: Commit**

```bash
git add src/types/mastodon.ts src/components/Toot/TootCard.vue src/utils/buildScheduledToot.ts src/utils/buildScheduledToot.test.ts
git commit -m "feat(composer): add buildScheduledToot and shared poll types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/types/mastodon.ts", "src/components/Toot/TootCard.vue", "src/utils/buildScheduledToot.ts", "src/utils/buildScheduledToot.test.ts"], "verifyCommand": "npx vitest run src/utils/buildScheduledToot.test.ts", "acceptanceCriteria": ["PollParams and PollFormState exported, no inline poll types left", "params.poll typed PollParams | null", "7 buildScheduledToot tests pass", "typecheck exits 0"], "requiresUserVerification": false}
```

---

### Task 2: `isOnlyScheduleChange`, null-safe detection of date-only edits

**Goal:** A pure, tested function decides whether an edit can use `PUT` (date only) or must recreate the toot.

**Files:**
- Create: `src/utils/isOnlyScheduleChange.ts`
- Test: `src/utils/isOnlyScheduleChange.test.ts`

**Acceptance Criteria:**
- [ ] Returns true when only `scheduled_at` differs, including when the API returned `null` for unset params
- [ ] Returns false when text, visibility, language, sensitivity, media or poll changed, or when `params` is missing
- [ ] Poll comparison normalizes `expires_in` to a number and `multiple`/`hide_totals` to booleans
- [ ] Falls back to `media_attachments` ids when `params.media_ids` is missing

**Verify:** `npx vitest run src/utils/isOnlyScheduleChange.test.ts` → `Tests  11 passed (11)`

**Steps:**

- [ ] **Step 1: Write the failing test** — create `src/utils/isOnlyScheduleChange.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isOnlyScheduleChange } from './isOnlyScheduleChange';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

function makeOriginal(params: Partial<NonNullable<MastodonStatus['params']>> = {}): MastodonStatus {
  return {
    id: '42',
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
    media_attachments: [],
    scheduled_at: '2030-01-01T12:00:00.000Z',
    params: {
      text: 'Hello',
      visibility: 'public',
      language: 'en',
      sensitive: false,
      spoiler_text: '',
      media_ids: [],
      poll: null,
      ...params,
    },
  };
}

function makeUpdated(overrides: Partial<ScheduledToot> = {}): ScheduledToot {
  return {
    status: 'Hello',
    scheduled_at: '2030-01-02T08:00:00.000Z',
    visibility: 'public',
    language: 'en',
    sensitive: false,
    spoiler_text: undefined,
    media_ids: [],
    ...overrides,
  };
}

describe('isOnlyScheduleChange', () => {
  it('is true when only the date changed', () => {
    expect(isOnlyScheduleChange(makeOriginal(), makeUpdated())).toBe(true);
  });

  it('treats null params from the API like empty values', () => {
    const original = makeOriginal({ sensitive: null as unknown as boolean, spoiler_text: null as unknown as string, media_ids: null as unknown as string[] });
    expect(isOnlyScheduleChange(original, makeUpdated())).toBe(true);
  });

  it.each([
    ['text', makeUpdated({ status: 'Hello!' })],
    ['visibility', makeUpdated({ visibility: 'unlisted' })],
    ['language', makeUpdated({ language: 'fr' })],
    ['sensitive flag', makeUpdated({ sensitive: true, spoiler_text: 'CW' })],
    ['media', makeUpdated({ media_ids: ['m1'] })],
    ['poll', makeUpdated({ poll: { options: ['Yes', 'No'], expires_in: 3600 } })],
  ])('is false when the %s changed', (_label, updated) => {
    expect(isOnlyScheduleChange(makeOriginal(), updated)).toBe(false);
  });

  it('compares polls after normalizing the duration and flags', () => {
    const original = makeOriginal({
      poll: { options: ['Yes', 'No'], expires_in: '3600' as unknown as number },
    });
    const updated = makeUpdated({ poll: { options: ['Yes', 'No'], expires_in: 3600, multiple: false, hide_totals: false } });
    expect(isOnlyScheduleChange(original, updated)).toBe(true);
  });

  it('falls back to media_attachments when params.media_ids is missing', () => {
    const original = { ...makeOriginal({ media_ids: undefined }), media_attachments: [{ id: 'm1' }] };
    expect(isOnlyScheduleChange(original, makeUpdated({ media_ids: ['m1'] }))).toBe(true);
  });

  it('is false when the original has no params', () => {
    expect(isOnlyScheduleChange({ ...makeOriginal(), params: undefined }, makeUpdated())).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/isOnlyScheduleChange.test.ts`
Expected: FAIL with `Failed to resolve import "./isOnlyScheduleChange"`.

- [ ] **Step 3: Write the implementation** — create `src/utils/isOnlyScheduleChange.ts`:

```ts
import type { MastodonStatus, PollParams, ScheduledToot } from '../types/mastodon';

function normalizePoll(poll: PollParams | null | undefined) {
  if (!poll) return null;
  return {
    options: poll.options,
    expires_in: Number(poll.expires_in),
    multiple: poll.multiple === true,
    hide_totals: poll.hide_totals === true,
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Tells whether an edited toot differs from its scheduled original by its date only.
 * In that case it can be rescheduled in place (PUT) instead of being recreated.
 * Mastodon returns null for unset params, so both sides are normalized before comparing.
 * @param {MastodonStatus} original - The scheduled status as returned by the API.
 * @param {ScheduledToot} updated - The payload built from the edited form.
 * @returns {boolean} True when only `scheduled_at` changed.
 */
export function isOnlyScheduleChange(original: MastodonStatus, updated: ScheduledToot): boolean {
  const params = original.params;
  if (!params) return false;

  const originalMediaIds: string[] = params.media_ids
    ?? (original.media_attachments ?? []).map((media: { id: string }) => media.id);

  return (
    (params.text ?? '') === updated.status
    && (params.visibility ?? 'public') === updated.visibility
    && (params.language ?? null) === (updated.language ?? null)
    && (params.sensitive === true) === (updated.sensitive === true)
    && (params.spoiler_text ?? '') === (updated.spoiler_text ?? '')
    && sameList(originalMediaIds, updated.media_ids ?? [])
    && JSON.stringify(normalizePoll(params.poll)) === JSON.stringify(normalizePoll(updated.poll))
  );
}
```

Design note: when in doubt, the function returns **false**. A false negative only means the toot is recreated (create-then-delete, which is safe). A false positive would silently drop the user's content change.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/utils/isOnlyScheduleChange.test.ts` → `Tests  11 passed (11)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`

- [ ] **Step 5: Commit**

```bash
git add src/utils/isOnlyScheduleChange.ts src/utils/isOnlyScheduleChange.test.ts
git commit -m "feat(toots): detect date-only edits of scheduled toots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/isOnlyScheduleChange.ts", "src/utils/isOnlyScheduleChange.test.ts"], "verifyCommand": "npx vitest run src/utils/isOnlyScheduleChange.test.ts", "acceptanceCriteria": ["true for date-only change incl. null params", "false for any content change or missing params", "poll normalized before comparison", "media_attachments fallback"], "requiresUserVerification": false}
```

---

### Task 3: `getNextPageUrl`, a same-origin Link-header parser

**Goal:** A pure, tested function extracts the `rel="next"` URL of a Mastodon `Link` header, and refuses any URL outside the instance origin, so the token is never sent elsewhere.

**Files:**
- Create: `src/utils/linkHeader.ts`
- Test: `src/utils/linkHeader.test.ts`

**Acceptance Criteria:**
- [ ] Returns the next URL from a header with `next` and `prev` links
- [ ] Returns `null` when there is no next link, no header, a malformed URL, or a URL on another origin (including a prefix lookalike such as `https://masto.example.evil.example`)

**Verify:** `npx vitest run src/utils/linkHeader.test.ts` → `Tests  5 passed (5)`

**Steps:**

- [ ] **Step 1: Write the failing test** — create `src/utils/linkHeader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getNextPageUrl } from './linkHeader';

const ORIGIN = 'https://masto.example';

describe('getNextPageUrl', () => {
  it('returns the next URL from a Mastodon Link header', () => {
    const header = '<https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=7>; rel="next", '
      + '<https://masto.example/api/v1/scheduled_statuses?limit=40&min_id=9>; rel="prev"';
    expect(getNextPageUrl(header, ORIGIN)).toBe('https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=7');
  });

  it('returns null when there is no next link', () => {
    expect(getNextPageUrl('<https://masto.example/api/v1/scheduled_statuses?min_id=9>; rel="prev"', ORIGIN)).toBeNull();
  });

  it('returns null for a missing header', () => {
    expect(getNextPageUrl(undefined, ORIGIN)).toBeNull();
    expect(getNextPageUrl('', ORIGIN)).toBeNull();
  });

  it('refuses a next link on another origin', () => {
    expect(getNextPageUrl('<https://evil.example/steal>; rel="next"', ORIGIN)).toBeNull();
    expect(getNextPageUrl('<https://masto.example.evil.example/x>; rel="next"', ORIGIN)).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(getNextPageUrl('<not a url>; rel="next"', ORIGIN)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/utils/linkHeader.test.ts`
Expected: FAIL with `Failed to resolve import "./linkHeader"`.

- [ ] **Step 3: Write the implementation** — create `src/utils/linkHeader.ts`:

```ts
/**
 * Returns the rel="next" URL of an HTTP Link header (RFC 8288), as used by Mastodon pagination.
 * The URL is only returned when it points to the expected origin, so the access token is never
 * sent to a host announced by a rogue instance.
 * @param {string | null | undefined} linkHeader - The raw `Link` response header.
 * @param {string} allowedOrigin - The instance origin, e.g. https://mastodon.social.
 * @returns {string | null} The next page URL, or null when there is none.
 */
export function getNextPageUrl(linkHeader: string | null | undefined, allowedOrigin: string): string | null {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(',')) {
    const match = /^\s*<([^>]*)>(.*)$/.exec(part);
    if (!match || !/;\s*rel="?next"?\s*(;|$)/.test(match[2])) continue;

    try {
      return new URL(match[1]).origin === allowedOrigin ? match[1] : null;
    } catch {
      return null;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/utils/linkHeader.test.ts` → `Tests  5 passed (5)`

- [ ] **Step 5: Commit**

```bash
git add src/utils/linkHeader.ts src/utils/linkHeader.test.ts
git commit -m "feat(api): add same-origin Link header pagination parser

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/linkHeader.ts", "src/utils/linkHeader.test.ts"], "verifyCommand": "npx vitest run src/utils/linkHeader.test.ts", "acceptanceCriteria": ["returns rel=next URL", "null for no next / no header / malformed / other origin"], "requiresUserVerification": false}
```

---

### Task 4: API layer: Idempotency-Key header, `rescheduleToot`, full pagination

**Goal:** `useMastodonApi` sends a real `Idempotency-Key` header, can reschedule in place, and returns **all** scheduled toots.

**Files:**
- Modify: `src/composables/useMastodonApi.ts` (imports; `scheduleToot`; new `rescheduleToot`; `getScheduledToots`; returned object)
- Test: `src/composables/useMastodonApi.test.ts`
- Modify (interim): `src/stores/scheduledToots.ts:70`, `src/components/Toot/TootComposer.vue:189`
- Modify: `.claude/skills/mastodon-api/SKILL.md:109`

**Acceptance Criteria:**
- [ ] `scheduleToot(toot, idempotencyKey)` sends `{ headers: { 'Idempotency-Key': idempotencyKey } }` and no `idempotency` body field
- [ ] `rescheduleToot(id, scheduledAt)` does `PUT {instance}/api/v1/scheduled_statuses/{id}` with `{ scheduled_at }`
- [ ] `getScheduledToots()` requests `?limit=40`, follows same-origin `rel="next"` links, stops after 10 pages, and never follows another origin
- [ ] The 3 debug `console.log` dumps of API responses in `getScheduledToots` are gone
- [ ] The mastodon-api skill no longer recommends a body `idempotency` field
- [ ] `npm run typecheck` exits 0 and `npm test` passes

**Verify:** `npx vitest run src/composables/useMastodonApi.test.ts` → `Tests  5 passed (5)`

**Steps:**

- [ ] **Step 1: Write the failing test** — create `src/composables/useMastodonApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScheduledToot } from '../types/mastodon';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../utils/api', () => ({ createApiClient: () => http }));
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({ instance: 'https://masto.example', accessToken: 'token' }),
}));

import { useMastodonApi } from './useMastodonApi';

const toot: ScheduledToot = {
  status: 'Hello',
  scheduled_at: '2030-01-01T12:00:00.000Z',
  visibility: 'public',
  language: 'en',
  media_ids: [],
};

describe('useMastodonApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('scheduleToot', () => {
    it('sends the idempotency key as a header, not in the body', async () => {
      http.post.mockResolvedValue({ data: { id: '1' } });

      await useMastodonApi().scheduleToot(toot, 'draft-key-1');

      const [url, body, config] = http.post.mock.calls[0];
      expect(url).toBe('https://masto.example/api/v1/statuses');
      expect(config).toEqual({ headers: { 'Idempotency-Key': 'draft-key-1' } });
      expect(body).not.toHaveProperty('idempotency');
      expect(body).toMatchObject({ status: 'Hello', scheduled_at: '2030-01-01T12:00:00.000Z' });
    });
  });

  describe('rescheduleToot', () => {
    it('PUTs only the new date to the scheduled status', async () => {
      http.put.mockResolvedValue({ data: { id: '42' } });

      await useMastodonApi().rescheduleToot('42', '2030-02-01T09:00:00.000Z');

      expect(http.put).toHaveBeenCalledWith(
        'https://masto.example/api/v1/scheduled_statuses/42',
        { scheduled_at: '2030-02-01T09:00:00.000Z' },
      );
    });
  });

  describe('getScheduledToots', () => {
    it('follows the Link header across pages and concatenates the results', async () => {
      http.get
        .mockResolvedValueOnce({
          data: [{ id: '3' }, { id: '2' }],
          headers: { link: '<https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2>; rel="next"' },
        })
        .mockResolvedValueOnce({ data: [{ id: '1' }], headers: {} });

      const toots = await useMastodonApi().getScheduledToots();

      expect(toots.map(t => t.id)).toEqual(['3', '2', '1']);
      expect(http.get.mock.calls.map(call => call[0])).toEqual([
        'https://masto.example/api/v1/scheduled_statuses?limit=40',
        'https://masto.example/api/v1/scheduled_statuses?limit=40&max_id=2',
      ]);
    });

    it('does not follow a next link pointing to another origin', async () => {
      http.get.mockResolvedValueOnce({
        data: [{ id: '1' }],
        headers: { link: '<https://evil.example/collect>; rel="next"' },
      });

      const toots = await useMastodonApi().getScheduledToots();

      expect(toots).toHaveLength(1);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('stops after 10 pages even if the server keeps announcing more', async () => {
      http.get.mockResolvedValue({
        data: [{ id: 'x' }],
        headers: { link: '<https://masto.example/api/v1/scheduled_statuses?max_id=x>; rel="next"' },
      });

      await useMastodonApi().getScheduledToots();

      expect(http.get).toHaveBeenCalledTimes(10);
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/composables/useMastodonApi.test.ts`
Expected: FAIL. In the `scheduleToot` test, `config` is `undefined`. `rescheduleToot` is not a function. The pagination test fails because the first URL has no `?limit=40`.

- [ ] **Step 3: Add the imports and constants**

In `src/composables/useMastodonApi.ts`, replace the line `import { handleApiError } from '../utils/error';` with:

```ts
import { handleApiError } from '../utils/error';
import { getNextPageUrl } from '../utils/linkHeader';

/** Mastodon's maximum page size for scheduled statuses. */
const SCHEDULED_PAGE_SIZE = 40;
/** Safety cap: 10 pages × 40 = 400 toots, above Mastodon's 300 scheduled-toot limit. */
const MAX_SCHEDULED_PAGES = 10;
```

- [ ] **Step 4: Replace `scheduleToot` and add `rescheduleToot`**

Replace the whole `scheduleToot` function, from its `/**` JSDoc line (`* Schedules a toot to be posted at a later time.`) up to, but not including, the `/**` of `sendDirectMessageAsUser`, with:

```ts
  /**
   * Schedules a toot to be posted at a later time.
   * @param {ScheduledToot} toot - The toot data including content and scheduling information.
   * @param {string} idempotencyKey - Unique key per draft; Mastodon ignores a resubmission with the same key for 1 hour.
   * @returns {Promise<MastodonStatus>} The scheduled toot data.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function scheduleToot(toot: ScheduledToot, idempotencyKey: string): Promise<MastodonStatus> {
    if (!auth.instance) throw new Error('No instance URL set');
  
    try {
      if (!toot.status) {
        throw new Error('Status content is required');
      }
  
      // Format the request payload according to Mastodon API specs
      const payload: Record<string, unknown> = {
        status: toot.status,
        scheduled_at: toot.scheduled_at,
        media_ids: toot.media_ids || [],
        visibility: toot.visibility || 'public',
        sensitive: toot.sensitive || false,
        spoiler_text: toot.spoiler_text || '',
        language: toot.language || null,
      };
  
      // Add poll data if present
      if (toot.poll) {
        payload.poll = {
          options: toot.poll.options,
          expires_in: toot.poll.expires_in,
          multiple: toot.poll.multiple || false,
          hide_totals: toot.poll.hide_totals || false,
        };
      }
  
      // Use the statuses endpoint with scheduled_at parameter
      const response = await api.post(`${auth.instance}/api/v1/statuses`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  /**
   * Moves a scheduled toot to a new date. Mastodon only allows changing `scheduled_at` this way.
   * @param {string} id - The ID of the scheduled toot.
   * @param {string} scheduledAt - The new ISO 8601 date, at least 5 minutes in the future.
   * @returns {Promise<MastodonStatus>} The updated scheduled toot.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function rescheduleToot(id: string, scheduledAt: string): Promise<MastodonStatus> {
    if (!auth.instance) throw new Error('No instance URL set');

    try {
      const response = await api.put(`${auth.instance}/api/v1/scheduled_statuses/${id}`, {
        scheduled_at: scheduledAt,
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }
```

- [ ] **Step 5: Replace `getScheduledToots`**

Replace the whole `getScheduledToots` function, from its `/**` JSDoc line (`* Retrieves the list of scheduled toots from the Mastodon instance.`) up to, but not including, the `/**` of `deleteScheduledToot`, with:

```ts
  /**
   * Retrieves all scheduled toots, following Mastodon's Link-header pagination.
   * @returns {Promise<MastodonStatus[]>} The list of scheduled toots.
   * @throws {Error} If the instance URL is not set or the request fails.
   */
  async function getScheduledToots(): Promise<MastodonStatus[]> {
    if (!auth.instance) throw new Error('No instance URL set');
    const instance = auth.instance;

    try {
      const toots: MastodonStatus[] = [];
      let url: string | null = `${instance}/api/v1/scheduled_statuses?limit=${SCHEDULED_PAGE_SIZE}`;

      for (let page = 0; url && page < MAX_SCHEDULED_PAGES; page++) {
        const response = await api.get<MastodonStatus[]>(url);
        toots.push(...response.data);
        const link = response.headers['link'];
        url = getNextPageUrl(typeof link === 'string' ? link : null, instance);
      }

      return toots;
    } catch (error) {
      console.error('Error fetching scheduled toots:', error);
      throw new Error(handleApiError(error));
    }
  }
```

- [ ] **Step 6: Expose `rescheduleToot` and update the returned JSDoc**

In the returned object at the bottom of the file, replace:

```ts
     * @param {ScheduledToot} toot - The toot data including content and scheduling information.
     * @returns {Promise<MastodonStatus>} The scheduled toot data.
     */
    scheduleToot,
```

with:

```ts
     * @param {ScheduledToot} toot - The toot data including content and scheduling information.
     * @param {string} idempotencyKey - Unique key per draft, sent as the Idempotency-Key header.
     * @returns {Promise<MastodonStatus>} The scheduled toot data.
     */
    scheduleToot,

    /**
     * Moves a scheduled toot to a new date.
     * @param {string} id - The ID of the scheduled toot.
     * @param {string} scheduledAt - The new ISO 8601 date.
     * @returns {Promise<MastodonStatus>} The updated scheduled toot.
     */
    rescheduleToot,
```

and replace:

```ts
     * Retrieves the list of scheduled toots from the Mastodon instance.
     * @returns {Promise<Array>} The list of scheduled toots.
```

with:

```ts
     * Retrieves all scheduled toots from the Mastodon instance, across all pages.
     * @returns {Promise<MastodonStatus[]>} The list of scheduled toots.
```

- [ ] **Step 7: Interim caller updates (replaced in Tasks 5 and 6)**

`npm run typecheck` now fails on the two `scheduleToot` callers. Keep them compiling with a per-call key. This matches today's behavior, and Tasks 5 and 6 replace it with a real per-draft key.

In `src/stores/scheduledToots.ts`, replace `        await api.scheduleToot(updatedToot);` with:

```ts
        await api.scheduleToot(updatedToot, crypto.randomUUID());
```

In `src/components/Toot/TootComposer.vue`, replace `      await api.scheduleToot(toot);` with:

```ts
      await api.scheduleToot(toot, crypto.randomUUID());
```

- [ ] **Step 8: Fix the mastodon-api skill guidance**

In `.claude/skills/mastodon-api/SKILL.md`, the payload example ends with these lines (around line 108):

```
  },
  idempotency: string,                     // Use Date.now().toString() to prevent duplicates
}
```

Replace them with:

```
  },
}
// Idempotency: send an `Idempotency-Key: <uuid>` request HEADER, not a body field.
// One key per draft: reuse it on retry, renew it after success. Mastodon keeps keys for 1 hour.
```

Run: `grep -n "idempotency\|Idempotency" .claude/skills/mastodon-api/SKILL.md`
Expected: a single match, the new `// Idempotency: …` comment line; no `idempotency: string` remains.

- [ ] **Step 9: Run the tests, the typecheck and the full suite**

Run: `npx vitest run src/composables/useMastodonApi.test.ts` → `Tests  5 passed (5)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`
Run: `npm test` → all pass (7 Lot 0 tests plus those added in Tasks 1–4: 35 total)
Run: `npm run lint` → `0 errors`

- [ ] **Step 10: Commit**

```bash
git add src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts src/stores/scheduledToots.ts src/components/Toot/TootComposer.vue .claude/skills/mastodon-api/SKILL.md
git commit -m "fix(api): send Idempotency-Key header, add rescheduleToot, paginate scheduled toots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts", "src/stores/scheduledToots.ts", "src/components/Toot/TootComposer.vue", ".claude/skills/mastodon-api/SKILL.md"], "verifyCommand": "npx vitest run src/composables/useMastodonApi.test.ts", "acceptanceCriteria": ["Idempotency-Key header, no body field", "rescheduleToot PUTs scheduled_at", "pagination limit=40, same-origin next only, max 10 pages", "debug response dumps removed", "skill doc corrected", "typecheck and tests pass"], "requiresUserVerification": false}
```

---

### Task 5: Setup store with a safe `updateToot` (create-then-delete, PUT for date-only)

**Goal:** Editing a scheduled toot can no longer lose it. The store follows the project's setup-store convention.

**Files:**
- Rewrite: `src/stores/scheduledToots.ts`
- Test: `src/stores/scheduledToots.test.ts`
- Modify (interim): `src/components/Toot/TootComposer.vue:170`

**Acceptance Criteria:**
- [ ] The store uses `defineStore('scheduledToots', () => { … })` and keeps the same public API used by components: `toots`, `isLoading`, `error`, `editingToot`, `count`, `sortedToots`, `setToots`, `setLoading`, `setError`, `setEditingToot`, `fetchScheduledToots`, `updateToot`
- [ ] `updateToot(original, updated, idempotencyKey)` calls `rescheduleToot` (and nothing else) for a date-only change
- [ ] For any other change it calls `scheduleToot` **before** `deleteScheduledToot`, and never deletes when creation fails
- [ ] It returns `{ previousVersionRemoved: false }` (without throwing) when the deletion fails after a successful creation
- [ ] `npm run typecheck` exits 0 and `npm test` passes

**Verify:** `npx vitest run src/stores/scheduledToots.test.ts` → `Tests  5 passed (5)`

**Steps:**

- [ ] **Step 1: Write the failing test** — create `src/stores/scheduledToots.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';

const api = vi.hoisted(() => ({
  getScheduledToots: vi.fn(),
  scheduleToot: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
}));

vi.mock('../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));

import { useScheduledTootsStore } from './scheduledToots';

const original: MastodonStatus = {
  id: '42',
  content: '',
  created_at: '',
  visibility: 'public',
  url: '',
  media_attachments: [],
  scheduled_at: '2030-01-01T12:00:00.000Z',
  params: { text: 'Hello', visibility: 'public', language: 'en', sensitive: false, spoiler_text: '', media_ids: [], poll: null },
};

function makeUpdated(overrides: Partial<ScheduledToot> = {}): ScheduledToot {
  return {
    status: 'Hello',
    scheduled_at: '2030-01-02T08:00:00.000Z',
    visibility: 'public',
    language: 'en',
    sensitive: false,
    media_ids: [],
    ...overrides,
  };
}

describe('scheduledToots store', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setActivePinia(createPinia());
    api.getScheduledToots.mockResolvedValue([]);
  });

  it('sorts toots by scheduled date', () => {
    const store = useScheduledTootsStore();
    store.setToots([
      { ...original, id: 'late', scheduled_at: '2030-03-01T00:00:00.000Z' },
      { ...original, id: 'early', scheduled_at: '2030-01-01T00:00:00.000Z' },
    ]);
    expect(store.sortedToots.map(t => t.id)).toEqual(['early', 'late']);
    expect(store.count).toBe(2);
  });

  describe('updateToot', () => {
    it('reschedules in place when only the date changed', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);

      const result = await store.updateToot(original, makeUpdated(), 'key-1');

      expect(api.rescheduleToot).toHaveBeenCalledWith('42', '2030-01-02T08:00:00.000Z');
      expect(api.scheduleToot).not.toHaveBeenCalled();
      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(result).toEqual({ previousVersionRemoved: true });
      expect(store.editingToot).toBeNull();
    });

    it('creates the new version before deleting the original', async () => {
      const store = useScheduledTootsStore();
      const calls: string[] = [];
      api.scheduleToot.mockImplementation(async () => { calls.push('create'); });
      api.deleteScheduledToot.mockImplementation(async () => { calls.push('delete'); });

      await store.updateToot(original, makeUpdated({ status: 'Hello again' }), 'key-1');

      expect(calls).toEqual(['create', 'delete']);
      expect(api.scheduleToot).toHaveBeenCalledWith(expect.objectContaining({ status: 'Hello again' }), 'key-1');
      expect(api.deleteScheduledToot).toHaveBeenCalledWith('42');
    });

    it('keeps the original when creating the new version fails', async () => {
      const store = useScheduledTootsStore();
      store.setEditingToot(original);
      api.scheduleToot.mockRejectedValue(new Error('Validation failed'));

      await expect(store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1')).rejects.toThrow('Validation failed');

      expect(api.deleteScheduledToot).not.toHaveBeenCalled();
      expect(store.error).toBe('Validation failed');
      expect(store.editingToot).toEqual(original);
    });

    it('reports a stale copy when deleting the original fails after creation', async () => {
      const store = useScheduledTootsStore();
      api.deleteScheduledToot.mockRejectedValue(new Error('Network Error'));

      const result = await store.updateToot(original, makeUpdated({ status: 'Changed' }), 'key-1');

      expect(result).toEqual({ previousVersionRemoved: false });
      expect(api.getScheduledToots).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/stores/scheduledToots.test.ts`
Expected: the 4 `updateToot` tests FAIL. The current store takes `(id, toot)`, calls delete before create, and never calls `rescheduleToot`. The sorting test passes already.

- [ ] **Step 3: Rewrite the store** — replace the whole of `src/stores/scheduledToots.ts` with:

```ts
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { MastodonStatus, ScheduledToot } from '../types/mastodon';
import { useMastodonApi } from '../composables/useMastodonApi';
import { isOnlyScheduleChange } from '../utils/isOnlyScheduleChange';

/** Outcome of an edit, so the UI can warn when a stale copy is left behind. */
export interface UpdateTootResult {
  /** False when the new version was scheduled but the previous one could not be deleted. */
  previousVersionRemoved: boolean;
}

function getTimestamp(toot: MastodonStatus): number {
  if (!toot.scheduled_at) return 0;
  const time = new Date(toot.scheduled_at).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * Creates a Pinia store for the user's scheduled toots.
 * @returns {Object} The scheduled toots store with state and actions.
 */
export const useScheduledTootsStore = defineStore('scheduledToots', () => {
  const toots = ref<MastodonStatus[]>([]);
  const isLoading = ref(false);
  const error = ref('');
  const editingToot = ref<MastodonStatus | null>(null);

  const count = computed(() => toots.value.length);
  const sortedToots = computed(() => [...toots.value].sort((a, b) => getTimestamp(a) - getTimestamp(b)));

  function setToots(value: MastodonStatus[]): void {
    toots.value = value;
  }

  function setLoading(value: boolean): void {
    isLoading.value = value;
  }

  function setError(value: string): void {
    error.value = value;
  }

  function setEditingToot(toot: MastodonStatus | null): void {
    editingToot.value = toot;
  }

  /**
   * Loads all scheduled toots from the instance.
   */
  async function fetchScheduledToots(): Promise<void> {
    try {
      setLoading(true);
      setError('');
      const api = useMastodonApi();
      setToots(await api.getScheduledToots());
    } catch (err) {
      console.error('Error fetching scheduled toots:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch scheduled toots');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Applies an edit to a scheduled toot without ever losing the original.
   * A date-only change is rescheduled in place. Any other change creates the new
   * version first and deletes the original only once the new one exists.
   * @param {MastodonStatus} original - The scheduled toot being edited.
   * @param {ScheduledToot} updated - The payload built from the edited form.
   * @param {string} idempotencyKey - The draft's idempotency key.
   * @returns {Promise<UpdateTootResult>} Whether the previous version was removed.
   * @throws {Error} If rescheduling or creating the new version fails (the original is kept).
   */
  async function updateToot(
    original: MastodonStatus,
    updated: ScheduledToot,
    idempotencyKey: string,
  ): Promise<UpdateTootResult> {
    try {
      setLoading(true);
      setError('');
      const api = useMastodonApi();
      let previousVersionRemoved = true;

      if (updated.scheduled_at && isOnlyScheduleChange(original, updated)) {
        await api.rescheduleToot(original.id, updated.scheduled_at);
      } else {
        await api.scheduleToot(updated, idempotencyKey);
        try {
          await api.deleteScheduledToot(original.id);
        } catch (err) {
          console.error('Error deleting the previous version of an edited toot:', err);
          previousVersionRemoved = false;
        }
      }

      await fetchScheduledToots();
      setEditingToot(null);
      return { previousVersionRemoved };
    } catch (err) {
      console.error('Error updating toot:', err);
      setError(err instanceof Error ? err.message : 'Failed to update toot');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    toots,
    isLoading,
    error,
    editingToot,
    count,
    sortedToots,
    setToots,
    setLoading,
    setError,
    setEditingToot,
    fetchScheduledToots,
    updateToot,
  };
});
```

- [ ] **Step 4: Interim caller update (replaced in Task 6)**

In `src/components/Toot/TootComposer.vue`, replace `      await store.updateToot(store.editingToot.id, updatedToot);` with:

```ts
      await store.updateToot(store.editingToot, updatedToot, crypto.randomUUID());
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npx vitest run src/stores/scheduledToots.test.ts` → `Tests  5 passed (5)`
Run: `npm run typecheck; echo "exit=$?"` → `exit=0`
Run: `npm test` → all pass

- [ ] **Step 6: Commit**

```bash
git add src/stores/scheduledToots.ts src/stores/scheduledToots.test.ts src/components/Toot/TootComposer.vue
git commit -m "fix(toots): never lose a toot when editing; migrate store to setup syntax

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/stores/scheduledToots.ts", "src/stores/scheduledToots.test.ts", "src/components/Toot/TootComposer.vue"], "verifyCommand": "npx vitest run src/stores/scheduledToots.test.ts", "acceptanceCriteria": ["setup store with unchanged public API", "date-only edit uses rescheduleToot only", "create before delete; no delete on failed create", "previousVersionRemoved false on failed delete", "typecheck and tests pass"], "requiresUserVerification": false}
```

---

### Task 6: Composer wiring: one idempotency key per draft, locked submit, poll and language fixes

**Goal:** The composer uses `buildScheduledToot` and the safe store, ignores double submits, reuses its idempotency key on retry, never sends a closed poll, and restores the language when editing.

**Files:**
- Modify: `src/components/Toot/PollSection.vue` (props type, `v-model.number`)
- Test: `src/components/Toot/PollSection.test.ts`
- Modify: `src/components/ControlsBar.vue` (`isSubmitting` prop, disabled button, label)
- Test: `src/components/ControlsBar.test.ts`
- Modify: `src/components/Toot/TootComposer.vue` (whole `<script setup>` block, plus 2 template attributes)
- Test: `src/components/Toot/TootComposer.test.ts`

**Acceptance Criteria:**
- [ ] `PollSection` emits `expiresIn` as a number
- [ ] `ControlsBar` disables the submit button while `isSubmitting` is true, showing `Scheduling…` or `Updating…`
- [ ] Two quick submits produce **one** `scheduleToot` call
- [ ] A retry after a failure reuses the idempotency key, and the next draft gets a new one
- [ ] Editing a toot whose `params.language` is `fr` selects `fr`
- [ ] Closing the poll section clears the poll, so it can't be sent later
- [ ] `npm run lint` (0 errors), `npm run typecheck`, `npm test` and `npm run build` pass

**Verify:** `npm test` → `Tests  47 passed (47)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

Create `src/components/Toot/PollSection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PollSection from './PollSection.vue';
import type { PollFormState } from '../../types/mastodon';

describe('PollSection', () => {
  it('emits the poll duration as a number', async () => {
    const wrapper = mount(PollSection);

    await wrapper.find('select').setValue('3600');

    const events = wrapper.emitted('update:modelValue') as [PollFormState][];
    const last = events[events.length - 1][0];
    expect(last.expiresIn).toBe(3600);
    expect(typeof last.expiresIn).toBe('number');
  });
});
```

Create `src/components/ControlsBar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlsBar from './ControlsBar.vue';

const baseProps = {
  scheduledDate: '',
  scheduledTime: '',
  visibility: 'public' as const,
  language: 'en',
  isEditing: false,
};

describe('ControlsBar', () => {
  it('enables the submit button when idle', () => {
    const button = mount(ControlsBar, { props: baseProps }).find('button[type="submit"]');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.text()).toBe('Schedule');
  });

  it('disables the submit button while submitting', () => {
    const button = mount(ControlsBar, { props: { ...baseProps, isSubmitting: true } }).find('button[type="submit"]');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toBe('Scheduling…');
  });

  it('shows the update labels in edit mode', () => {
    expect(mount(ControlsBar, { props: { ...baseProps, isEditing: true } }).find('button[type="submit"]').text()).toBe('Update');
    expect(mount(ControlsBar, { props: { ...baseProps, isEditing: true, isSubmitting: true } }).find('button[type="submit"]').text()).toBe('Updating…');
  });
});
```

Create `src/components/Toot/TootComposer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { addDays, format } from 'date-fns';
import type { MastodonStatus } from '../../types/mastodon';

const api = vi.hoisted(() => ({
  scheduleToot: vi.fn(),
  rescheduleToot: vi.fn(),
  deleteScheduledToot: vi.fn(),
  getScheduledToots: vi.fn(),
  verifyCredentials: vi.fn(),
}));

vi.mock('../../composables/useMastodonApi', () => ({ useMastodonApi: () => api }));
vi.mock('../../stores/auth', () => ({ useAuthStore: () => ({ account: null, accessToken: null }) }));
vi.mock('vue-toastification', () => ({
  useToast: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import TootComposer from './TootComposer.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';

let pinia: Pinia;

function mountComposer(): VueWrapper {
  return mount(TootComposer, { global: { plugins: [pinia] } });
}

async function fillForm(wrapper: VueWrapper, text = 'Hello'): Promise<void> {
  await wrapper.find('textarea').setValue(text);
  await wrapper.find('#scheduled-date').setValue(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  await wrapper.find('#scheduled-time').setValue('12:00');
}

describe('TootComposer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pinia = createPinia();
    setActivePinia(pinia);
    api.getScheduledToots.mockResolvedValue([]);
  });

  it('sends a single request when the form is submitted twice quickly', async () => {
    let finish!: () => void;
    api.scheduleToot.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const wrapper = mountComposer();
    await flushPromises();
    await fillForm(wrapper);

    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');

    expect(api.scheduleToot).toHaveBeenCalledTimes(1);
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();

    finish();
    await flushPromises();
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('reuses the idempotency key after a failure and renews it after a success', async () => {
    api.scheduleToot.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue({});
    const wrapper = mountComposer();
    await flushPromises();

    await fillForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('Network Error');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    await fillForm(wrapper, 'Second toot');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const keys = api.scheduleToot.mock.calls.map(call => call[1]);
    expect(keys).toHaveLength(3);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('restores the language of the toot being edited', async () => {
    const wrapper = mountComposer();
    await flushPromises();
    const toot: MastodonStatus = {
      id: '42',
      content: '',
      created_at: '',
      visibility: 'public',
      url: '',
      media_attachments: [],
      scheduled_at: '2030-01-01T12:00:00.000Z',
      params: { text: 'Bonjour', visibility: 'public', language: 'fr', poll: null },
    };

    useScheduledTootsStore().setEditingToot(toot);
    await flushPromises();

    expect((wrapper.find('#language').element as HTMLSelectElement).value).toBe('fr');
  });
});
```

Test design notes:
- `useMastodonApi`, the auth store and `vue-toastification` are mocked. The scheduled-toots store is the **real** one, so the composer–store integration is exercised.
- `accessToken: null` keeps `onMounted` from calling `verifyCredentials`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run src/components`
Expected failures:
- PollSection: `expiresIn` is `'3600'` (a string).
- ControlsBar: no `disabled` attribute, label `Schedule` instead of `Scheduling…`.
- TootComposer: `scheduleToot` is called **2** times; the keys differ between the failure and the retry; the language is `en`.

- [ ] **Step 3: `PollSection.vue`**

In `src/components/Toot/PollSection.vue`, replace:

```ts
import { ref, watch } from 'vue';

interface PollSectionProps {
  modelValue?: {
    options: string[];
    expiresIn: number;
    multiple: boolean;
    hideTotals: boolean;
  };
}
```

with:

```ts
import { ref, watch } from 'vue';
import type { PollFormState } from '../../types/mastodon';

interface PollSectionProps {
  modelValue?: PollFormState;
}
```

and replace `<select v-model="pollExpiresIn">` with `<select v-model.number="pollExpiresIn">`.

- [ ] **Step 4: `ControlsBar.vue`**

In `src/components/ControlsBar.vue`, replace:

```ts
defineProps<{
  scheduledDate: string;
  scheduledTime: string;
  visibility: ScheduledToot['visibility'];
  language: string;
  isEditing: boolean;
}>();
```

with:

```ts
const props = withDefaults(defineProps<{
  scheduledDate: string;
  scheduledTime: string;
  visibility: ScheduledToot['visibility'];
  language: string;
  isEditing: boolean;
  isSubmitting?: boolean;
}>(), {
  isSubmitting: false,
});
```

Insert right before `const minDateTime = computed(() => {`:

```ts
const submitLabel = computed(() => {
  if (props.isSubmitting) return props.isEditing ? 'Updating…' : 'Scheduling…';
  return props.isEditing ? 'Update' : 'Schedule';
});

```

In the template, replace:

```html
    <button
      type="submit"
      :class="{ 'edit-mode': isEditing }"
    >
      {{ isEditing ? 'Update' : 'Schedule' }}
    </button>
```

with:

```html
    <button
      type="submit"
      :class="{ 'edit-mode': isEditing }"
      :disabled="isSubmitting"
    >
      {{ submitLabel }}
    </button>
```

(The `.form-actions button:disabled` style already exists in this file, so no CSS change is needed.)

- [ ] **Step 5: `TootComposer.vue`: replace the whole `<script setup>` block**

Replace everything from `<script setup lang="ts">` to `</script>` (inclusive) in `src/components/Toot/TootComposer.vue` with:

```vue
<script setup lang="ts">
// Constants
const MIN_SCHEDULE_AHEAD_MINUTES = 5;
const DEFAULT_POLL_EXPIRATION_SECONDS = 86400; // 24 hours

import { ref, onMounted, watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useMastodonApi } from '../../composables/useMastodonApi';
import { useAuthStore } from '../../stores/auth';
import { format, addMinutes, isBefore, parseISO } from 'date-fns';
import type { ScheduledToot, MastodonMediaAttachment, PollFormState } from '../../types/mastodon';
import { buildScheduledToot } from '../../utils/buildScheduledToot';
import ScheduledToots from './ScheduledToots.vue';
import { useScheduledTootsStore } from '../../stores/scheduledToots';
import MediaUpload from '../MediaUpload.vue';
import ContentWarning from '../ContentWarning.vue';
import ContentArea from '../ContentArea.vue';
import ControlsBar from '../ControlsBar.vue';
import PollSection from '../Toot/PollSection.vue';

function createEmptyPoll(): PollFormState {
  return {
    options: ['', ''],
    expiresIn: DEFAULT_POLL_EXPIRATION_SECONDS,
    multiple: false,
    hideTotals: false,
  };
}

const auth = useAuthStore();
const toast = useToast();
const content = ref('');
const scheduledDate = ref('');
const scheduledTime = ref('');
const isSubmitting = ref(false);
const visibility = ref<ScheduledToot['visibility']>('public');
const language = ref('en');
const error = ref('');
const isSensitive = ref(false);
const showMedia = ref(false);
const showPoll = ref(false);
const spoilerText = ref('');
const mediaAttachments = ref<MastodonMediaAttachment[]>([]);
const pollData = ref<PollFormState>(createEmptyPoll());

/**
 * One key per draft: a retry after a failure reuses it, so Mastodon never creates
 * the same toot twice. It is renewed once the draft has been scheduled or discarded.
 */
const idempotencyKey = ref(crypto.randomUUID());

const api = useMastodonApi();
const store = useScheduledTootsStore();

function handleShowMedia() {
  showMedia.value = !showMedia.value;
}

function handleShowPoll() {
  showPoll.value = !showPoll.value;
  // A closed poll section means no poll: drop what was typed so it can't be sent later.
  if (!showPoll.value) {
    pollData.value = createEmptyPoll();
  }
}

// Watch for editing toot changes
watch(() => store.editingToot, (newToot) => {
  if (newToot) {
    content.value = newToot.params?.text || '';
    
    // Parse the scheduled date and time
    if (newToot.scheduled_at) {
      const date = parseISO(newToot.scheduled_at);
      scheduledDate.value = format(date, 'yyyy-MM-dd');
      scheduledTime.value = format(date, 'HH:mm');
    }
    
    visibility.value = newToot.params?.visibility as ScheduledToot['visibility'] || 'public';
    language.value = newToot.params?.language || 'en';
    isSensitive.value = newToot.params?.sensitive || false;
    spoilerText.value = newToot.params?.spoiler_text || '';
    mediaAttachments.value = newToot.media_attachments || [];

    // Show media section if there are media attachments
    showMedia.value = newToot.media_attachments?.length > 0;

    const poll = newToot.params?.poll;
    if (poll) {
      showPoll.value = true;
      pollData.value = {
        options: poll.options || [],
        expiresIn: Number(poll.expires_in) || DEFAULT_POLL_EXPIRATION_SECONDS,
        multiple: poll.multiple || false,
        hideTotals: poll.hide_totals || false
      };
    } else {
      showPoll.value = false;
      pollData.value = createEmptyPoll();
    }
  }
}, { immediate: true });

function resetForm() {
  content.value = '';
  scheduledDate.value = '';
  scheduledTime.value = '';
  error.value = '';
  isSensitive.value = false;
  spoilerText.value = '';
  visibility.value = 'public';
  language.value = 'en';
  mediaAttachments.value = [];
  showMedia.value = false;
  showPoll.value = false;
  pollData.value = createEmptyPoll();
  idempotencyKey.value = crypto.randomUUID();
}

function handleCancelEdit() {
  store.setEditingToot(null);
  resetForm();
}

onMounted(async () => {
  console.log('Initial auth account:', auth.account);
  if (!auth.account && auth.accessToken) {
    try {
      const accountData = await api.verifyCredentials();
      auth.setAccount(accountData);
      console.log('Fetched account:', accountData);
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  }
  await store.fetchScheduledToots();
});

async function handleSubmit() {
  // Ignore resubmissions (double click, Enter key) while a request is in flight.
  if (isSubmitting.value) return;
  isSubmitting.value = true;
  error.value = '';

  try {
    // Validate scheduled time
    const scheduledDateTime = new Date(`${scheduledDate.value}T${scheduledTime.value}`);
    const minTime = addMinutes(new Date(), MIN_SCHEDULE_AHEAD_MINUTES);
    
    if (isBefore(scheduledDateTime, minTime)) {
      error.value = `Please schedule the toot at least ${MIN_SCHEDULE_AHEAD_MINUTES} minutes in the future.`;
      return;
    }

    const toot = buildScheduledToot({
      content: content.value,
      scheduledAt: scheduledDateTime,
      visibility: visibility.value,
      language: language.value,
      isSensitive: isSensitive.value,
      spoilerText: spoilerText.value,
      mediaIds: mediaAttachments.value.map(media => media.id),
      showPoll: showPoll.value,
      poll: pollData.value,
    });

    if (store.editingToot) {
      const result = await store.updateToot(store.editingToot, toot, idempotencyKey.value);
      if (!result.previousVersionRemoved) {
        toast.warning('Your toot was updated, but the previous version could not be removed. Please delete it from the list.');
      }
    } else {
      await api.scheduleToot(toot, idempotencyKey.value);
    }
    
    // Reset form and refresh toots
    resetForm();
    store.setEditingToot(null);
    await store.fetchScheduledToots();
    
  } catch (err) {
    console.error('Error scheduling toot:', err);
    error.value = err instanceof Error ? err.message : 'Failed to schedule toot. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>
```

What changed versus the current script:
- `buildScheduledToot` replaces the two duplicated payload blocks (CC-03).
- The `idempotencyKey` ref is renewed in `resetForm`, so it stays the same across retries of the same draft (BUG-02).
- `handleSubmit` returns early while `isSubmitting` is true (BUG-02).
- Closing the poll resets `pollData` (BUG-04).
- The edit watcher reads `params.language` and `params.poll`, with `Number()` on the duration (BUG-05 and BUG-07).
- `store.updateToot(original, toot, key)` is called, with a toast warning when a stale copy remains (BUG-01).
- The `Found poll data` debug log is removed.

- [ ] **Step 6: `TootComposer.vue`: two template attributes**

In the `<ContentArea …>` element, replace:

```html
        :has-poll="pollData.options.some(option => option.trim() !== '')"
```

with:

```html
        :has-poll="showPoll && pollData.options.some(option => option.trim() !== '')"
```

In the `<ControlsBar …>` element, add `:is-submitting="isSubmitting"` right after `:is-editing="!!store.editingToot"`:

```html
        :is-editing="!!store.editingToot"
        :is-submitting="isSubmitting"
        @cancel="handleCancelEdit"
```

- [ ] **Step 7: Run everything**

```bash
npm test
npm run typecheck; echo "exit=$?"
npm run lint
npm run build
```

Expected: `Tests  47 passed (47)`, `exit=0`, `0 errors` (the warning count drops from 12 to 7), and `✓ built in …`.

- [ ] **Step 8: Prove the composer tests guard the bugs**

Temporarily change `language.value = newToot.params?.language || 'en';` to `language.value = newToot.language || 'en';`, and comment out `if (isSubmitting.value) return;`. Run `npx vitest run src/components/Toot/TootComposer.test.ts`.
Expected: `2 failed | 1 passed`. Revert both edits (check that `git diff src/components/Toot/TootComposer.vue` shows only this task's intended changes), then run `npm test` again → 47 passed.

- [ ] **Step 9: Commit**

```bash
git add src/components/Toot/PollSection.vue src/components/Toot/PollSection.test.ts src/components/ControlsBar.vue src/components/ControlsBar.test.ts src/components/Toot/TootComposer.vue src/components/Toot/TootComposer.test.ts
git commit -m "fix(composer): block double submit, reuse idempotency key per draft, fix poll and language edits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/components/Toot/PollSection.vue", "src/components/Toot/PollSection.test.ts", "src/components/ControlsBar.vue", "src/components/ControlsBar.test.ts", "src/components/Toot/TootComposer.vue", "src/components/Toot/TootComposer.test.ts"], "verifyCommand": "npm test", "acceptanceCriteria": ["PollSection emits numeric expiresIn", "ControlsBar disabled + label while submitting", "double submit -> one scheduleToot call", "idempotency key reused on retry, renewed after success", "edit restores params.language", "closing poll clears it", "lint 0 errors, typecheck, tests (47), build pass"], "requiresUserVerification": false}
```

---

### Task 7: Release 0.13.2

**Goal:** Version 0.13.2, with user-facing "What's New" entries for the four data-integrity fixes.

**Files:**
- Modify: `package.json`, `package-lock.json` (version)
- Modify: `src/stores/features.ts` (prepend a `FeatureGroup`)

**Acceptance Criteria:**
- [ ] `package.json` version is `0.13.2`, matching the first `FeatureGroup.version`
- [ ] The 4 feature ids are unique across `features`
- [ ] lint (0 errors), typecheck, test and build pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.13.2`

**Steps:**

- [ ] **Step 1: Read `.claude/skills/changelog/SKILL.md` and follow it.** This is a PATCH bump: bug fixes, using the `🐛 Fix:` title prefix.

- [ ] **Step 2: Bump the version**

```bash
npm version patch --no-git-tag-version
```

Expected: `v0.13.2`.

- [ ] **Step 3: Check that the ids are unique**

Run: `grep -nE "safe-toot-editing|no-duplicate-toots|all-scheduled-toots-listed|poll-and-language-fixes" src/stores/features.ts`
Expected: no output.

- [ ] **Step 4: Prepend this group at the very top of the `features` array in `src/stores/features.ts`** (before `version: '0.13.1'`):

```ts
    {
      version: '0.13.2',
      date: '2026-10-02',
      features: [
        {
          id: 'safe-toot-editing',
          title: '🐛 Fix: Editing Never Loses a Toot',
          description: 'Editing a scheduled toot now creates the new version before removing the old one, and a simple date change is applied in place. If something goes wrong, your original toot stays safe.'
        },
        {
          id: 'no-duplicate-toots',
          title: '🐛 Fix: No More Duplicate Toots',
          description: 'Clicking Schedule twice, or retrying after a network hiccup, no longer creates the same toot twice.'
        },
        {
          id: 'all-scheduled-toots-listed',
          title: '🐛 Fix: All Your Scheduled Toots Are Listed',
          description: 'If you have more than 20 scheduled toots, you now see all of them instead of only the first 20.'
        },
        {
          id: 'poll-and-language-fixes',
          title: '🐛 Fix: Polls and Languages When Editing',
          description: 'A poll you closed is no longer sent by mistake, and editing a toot keeps its original language.'
        },
      ],
    },
```

Use the actual date if the work lands on a different day.

- [ ] **Step 5: Verify**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts
git commit -m "chore(release): 0.13.2 — data integrity fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.13.2 in package.json and features store", "4 unique feature ids", "lint, typecheck, test, build pass"], "requiresUserVerification": false}
```

---

### Task 8: User verification on a real Mastodon instance

**Goal:** The user confirms on a real instance that toots can no longer be lost or duplicated. Unit tests mock the API, so they cannot prove the actual Mastodon behaviors: media reuse on create-then-delete, idempotency, PUT, and the CORS exposure of `Link`.

**Files:** none (manual check)

**Acceptance Criteria:**
- [ ] The user ran the checklist below and selected "All checks pass"

**Verify:** the user's answer to the AskUserQuestion below

**Steps:**

- [ ] **Step 1: Hand the checklist to the user.** Run `npm run dev`, sign in to a real instance (a test account is recommended) and open DevTools → Network:
  1. **Double click:** write a toot, pick a date, double-click **Schedule**. Expected: one new toot in the list, one `POST /api/v1/statuses` carrying an `Idempotency-Key` request header.
  2. **Date-only edit:** edit a toot, change only the time, click **Update**. Expected: one `PUT /api/v1/scheduled_statuses/:id`, no POST and no DELETE; the list count is unchanged and shows the new time.
  3. **Content edit:** edit the text of a toot, click **Update**. Expected: `POST` then `DELETE`, in that order; the count is unchanged and the new text is shown.
  4. **Edit with media:** on a toot that has an image, change the text, click **Update**. Expected: the new version still shows "with 1 media" (Mastodon accepts the media being reattached before the original is deleted).
  5. **Failure keeps the original:** edit the text, switch DevTools → Network to **Offline**, click **Update**. Expected: an error message appears. Go back online and reload: the original toot is still listed, unchanged.
  6. **Closed poll:** open the poll section, type two options, close it, add an image, schedule. Expected: success, and the toot has media and no poll.
  7. **Language:** schedule a toot in Français, then click **Edit**. Expected: the Language select shows Français.
  8. *(Optional, if the account has more than 20 scheduled toots)* the counter shows the real total, and `GET …scheduled_statuses?limit=40` is followed by a `max_id=` request.
  9. **Edit a toot deleted elsewhere:** open toot X in edit mode; in a second tab delete X; back in the first tab change the text and click **Update**. Expected: the "already been published or deleted" error, a `GET /scheduled_statuses/:id` answering 404, no POST, no new toot.
  10. **Identical retry after a failure:** edit the text, go **Offline**, click **Update** (fails); go back online and click **Update** again without changing anything. Expected: exactly one POST then one DELETE, count unchanged.
  11. **Date-only edit of a toot with a poll, and of one with a CW:** expected a `PUT`, not POST + DELETE. If you see POST + DELETE, nothing is lost, but note it (the comparison is stricter than this instance's echo format).
  12. **Edit lock:** schedule a toot 6 minutes ahead, wait about a minute, then change its text and click **Update**. Expected: "This toot is about to be published and can no longer be edited.", no network request at all (no GET, POST or DELETE), and the toot publishes once with its original text.
  13. **Media after publication (complements check 4):** schedule the edited toot with an image about 6 minutes ahead and confirm the published post really carries the image and its alt text.

**User Verification Required:**
Before marking this task complete, you MUST call AskUserQuestion:
```yaml
AskUserQuestion:
  question: "On your Mastodon instance, do the Lot 1 checks pass (1–7 and 9–13; 8 if you have more than 20 toots)?"
  header: "Verification"
  options:
    - label: "All checks pass"
      description: "No loss, no duplicate, behavior as expected: Lot 1 can be closed"
    - label: "A check fails"
      description: "Tell me which number and what you saw; the task goes back to fixing, then re-verification"
```

```json:metadata
{"files": [], "verifyCommand": "", "acceptanceCriteria": ["user confirms the 7 checks on a real instance"], "requiresUserVerification": true, "userVerificationPrompt": "On your Mastodon instance, do the Lot 1 checks pass (1–7 and 9–13; 8 if you have more than 20 toots)?"}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. Push `fix/lot-1-data-integrity` and open a PR with base `chore/lot-0-quality-gate` (stacked on PR #38). Once #38 is merged, GitHub retargets it to `main`.

## Self-review notes

- **Spec coverage (Lot 1):**
  - `buildScheduledToot` (poll only if `showPoll`, never with media, spoiler only if sensitive) → Task 1.
  - Idempotency-Key header + one UUID per draft, renewed after success or reset → Tasks 4 and 6.
  - D3 PUT for date-only, otherwise create-then-delete, with a warning toast if deletion fails → Tasks 2, 5 and 6.
  - `limit=40` + `Link` `rel=next` with a 10-page cap → Tasks 3 and 4.
  - Submit button disabled with a "Scheduling…" label → Task 6.
  - `params.language` → Task 6. Poll reset on close → Task 6. `v-model.number` → Task 6.
  - Skill doc fix → Task 4. Setup store (CC-06) → Task 5. `PollParams` (deferred item) → Task 1.
  - All spec tests are covered: Task 1 for the builder, Task 5 for the store, Task 4 for pagination and the header, Task 6 for the double click. The spec's manual check is Task 8.
- **Additions beyond the spec (justified):**
  - Same-origin filtering of the `next` link, so the token is never sent to a host named by the server (web-security §4).
  - The rejection of a single-option poll, which Mastodon would reject anyway, with a worse error message.
- **Known limitation, kept for Lot 4 (UI):** the media/poll checkboxes in `ContentArea` keep their own local `checked` state. When editing a toot with a poll, the poll checkbox looks unchecked, and clicking it now closes and clears the poll. Lot 4 already plans to rework those controls.
- **Hardening beyond the plan (from task and final reviews):**
  - `isOnlyScheduleChange` treats string or uninterpretable booleans, a null visibility, non-numeric poll durations and option-less polls as changes (it fails closed toward recreate).
  - `getNextPageUrl` returns the normalized href. Pagination also stops on a repeated URL or an empty page.
  - `rescheduleToot` and `deleteScheduledToot` encode the id.
  - `updateToot` refuses a content edit less than 5 minutes before publication, refuses to recreate a toot that no longer exists (`scheduledTootExists`), and rechecks existence after a failed DELETE before warning.
  - Idempotency key: the spec says "one key per draft, renewed after success/reset". The implementation instead reuses the key only for an identical retry (same payload and same edited toot id); any change gets a new key. Reason: reusing a key after a change would make Mastodon return the earlier result, which could publish stale content or lose an edit.
  - After a failed submit the list is refreshed, so a toot created despite a lost response shows up.
- **Known residuals (accepted):**
  - If a POST succeeds but its response is lost, and the user changes the payload before retrying, two copies exist. Both are visible in the refreshed list and can be deleted.
  - A content edit fails while the target day is at Mastodon's scheduled-toot limit (25 per day, 300 in total), because the new version is created before the old one is removed. The original is kept and the server's error is shown.
  - A date-only edit of a toot created outside this app with a null language or visibility is recreated (not rescheduled) with the form's values.
  - Deleting, from the list, the toot open in the composer leaves the composer in edit mode; the update is then refused with a clear message (UI rework in Lot 4).
  - The 5-minute edit lock uses the browser clock. If the client clock runs more than ~5 minutes behind the server, the original can publish mid-edit, and the existence recheck after a failed DELETE then reads as "removed", leaving a silent duplicate.
  - The ContentArea checkbox state issue (Lot 4).
