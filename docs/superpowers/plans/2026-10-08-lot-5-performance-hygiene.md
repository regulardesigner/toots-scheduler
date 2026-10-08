# Lot 5 — Performance & Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first visit light and the code base tidy, and fix the defects earlier lots left behind:
- the fonts become subset variable WOFF2 files, 1.34 MB → 128 KB;
- an error nothing handled shows a generic toast instead of failing silently;
- the page gets a description, a theme colour and Open Graph tags;
- shared constants, no dead code, no test-only exports, no unused dependency;
- carry-overs:
  - the dialog scroll lock, which never shipped;
  - readable toasts;
  - no bearer token in the console;
  - one list request per visit;
  - a `MastodonStatus` type that matches what zod validates.

**Architecture:**
- **Fonts:** both families are self-hosted WOFF2, subset to Latin and Latin Extended with fontTools, one file per family:
  - Nunito Sans keeps its `wght` and `opsz` axes. `wdth` and `YTLC` are pinned to the values the CSS always set, so rendering is unchanged.
  - Winky Sans keeps `wght`.
  - Italics are dropped: the app never uses them.
  - `fonts.css` keeps only the three utility classes the templates use.
- **Global styles:** `App.vue`'s unscoped `<style>` is the stylesheet that ships. `src/style.css` was never imported, so Lot 4's `body.modal-open` rule never reached production; it moves into `App.vue`. Toast colours are overridden in a new `src/assets/styles/toasts.css`, imported right after the library's CSS. Only palette colours are used, and each pair is at least 4.5:1, which a unit test computes. There is no inline style, because of the CSP.
- **Errors:**
  - `logError(context, error)` is the app's only console call. It runs in DEV only, and prints one line: message, HTTP status and code. It never prints the request config, which holds `Authorization: Bearer …`.
  - `useGlobalErrorHandler(app)` sets `app.config.errorHandler` and listens for `unhandledrejection`. Both show one generic toast through `useNotify`, at most every 5 s.
  - The browser's own "Uncaught (in promise)" log is suppressed with `preventDefault()`.
  - ESLint's `no-console` becomes an error.
- **Hygiene:**
  - `src/config/constants.ts` holds the languages and the default limits; the OAuth scopes have been there since Lot 2.
  - The features store parses its saved state with zod inside `try`/`catch`, and `lastThreeNewFeatures` becomes `recentNewFeatures`.
  - JSDoc lives where things are defined, not again in returned objects.
  - `@vueuse/*` is removed.
- **Scheduled toots:**
  - The list component alone loads the list.
  - `MastodonStatus` becomes the validated shape: required `params` with nullable fields, typed media, and no fields that a scheduled status lacks.
  - `TootCard` accepts those nulls and gets a camelCase `spoilerText` prop.

**Tech Stack:** Vue 3.5, TypeScript 5.7, Pinia 2 (setup stores), zod 3.24, Vitest 4 + @vue/test-utils + happy-dom. Two tools stay out of the project:
- fontTools 4.66.1 + brotli 1.2.0, in a throw-away Python venv, used once by Task 1;
- Playwright + axe-core 4.14, in the scratchpad, for the controller's end-to-end run.

**User Verification:** YES. Task 9 is the gate. The controller runs:
- unit tests, typecheck, lint and build;
- the font size check;
- `npx depcheck`;
- its Playwright suite on the production build in Chromium and WebKit: the 41/42 existing checks plus seven Lot 5 checks.

It then asks the user to run Lighthouse performance (≥ 90 on the landing page, desktop and mobile) on the deployed site.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 5:
- WEB-02 (fonts);
- WEB-05 (global error handling);
- WEB-06 (meta);
- CC-04 (constants);
- CC-06 (conventions: JSDoc);
- CC-07 (dead code);
- CC-08 (dependencies);
- CC-09 (`JSON.parse`).

It also covers the residuals Lot 4 left for this lot: the double list fetch and toast contrast. The user added these carry-overs:
- the bearer token in logs;
- the test-only exports;
- the `schedule-button` id;
- the `MastodonStatus` type;
- the unused `src/style.css` and the scroll lock.

Audit: [docs/audits/2026-10-01-red-team-report.md](../../audits/2026-10-01-red-team-report.md).

---

## Context the engineer needs

- **Branch:** `fix/lot-5-performance-hygiene`, stacked on Lot 4 (PR #43). Open the PR against `fix/lot-4-a11y-instance-limits`, or against `main` if Lot 4 has been merged by then.
- **Quality commands:**
  - `npm run lint` must report 0 errors. It reports 4 warnings today; there are 2 after Task 3 and 0 after Task 7;
  - `npm run typecheck` (`vue-tsc -b`; it also checks the `*.test.ts` files);
  - `npm test`, which has **384 tests** at the start;
  - `npm run build`.

  Tests live next to their sources (`*.test.ts`) and import from `'vitest'` explicitly.
- **Commits:** one commit per task, with the exact `git add` paths given. **Never stage `*.tasks.json`**, and never use `git add -A` or `git add .`. Deletions are staged with `git rm`.
- **Shell:** the user's shell is zsh. Quote globs and brackets, as in `--layout-features='*'`.
- **Skills:**
  - read `.claude/skills/vue3-codegen/SKILL.md`, `.claude/skills/ui-design-system/SKILL.md` (Task 2's colours) and `.claude/skills/web-security/SKILL.md` (§2 and §6 for Task 3);
  - read `.claude/skills/changelog/SKILL.md` for Tasks 6 and 8;
  - `.claude/skills/mastodon-api/SKILL.md` is not needed: no endpoint changes.
- **Font tooling** (checked in the dry run):
  - Neither `pyftsubset` nor `glyphhanger` is installed. Task 1 creates a Python venv in a temporary folder, outside the repo, with pinned `fonttools==4.66.1` and `brotli==1.2.0`. Python 3.13 and pip were available.
  - Sources: the Google Fonts variable TTFs already in the repo.
    - Nunito Sans has the axes `wght` 200–1000, `wdth` 75–125 (default 100), `opsz` 6–12 and `YTLC` 440–540 (default 500).
    - Winky Sans has `wght` 300–900.
  - Usage found in the code:
    - Nunito Sans is the `:root` font, at weights 400, 500, 600 and 700, plus headings (bold);
    - Winky Sans is used through `.winky-sans-500`, `-700` and `-900`;
    - `font-family: "Winky Sans"` appears once in `LandingPage.vue`;
    - **no italic anywhere**: no `font-style`, no `<em>` or `<i>`;
    - no other `.nunito-sans-*` or `.winky-sans-*` class is used;
    - the CSS sets `font-variation-settings: "wdth" 100, "YTLC" 500`, which are the axis defaults.
  - Output sizes in the dry run: Nunito Sans 80,688 bytes, Winky Sans 46,880 bytes, **127,568 bytes in `dist/assets`**, against 1,338,219 bytes before. The four TTFs in `dist` were 569 KB, 556 KB, 108 KB and 105 KB.
    - Winky's file is byte-identical across runs.
    - Nunito's varies by a few bytes, because the instancer's output differs slightly.
    - Subsetting alone, without pinning `wdth` and `YTLC`, gave a 132 KB Nunito. Pinning `opsz` too would give 50 KB, but would change the two texts set below 12 px.
- **Vitest facts** (learned in the dry run):
  - a CSS file imported with `?raw` is an **empty string** unless `test.css.include` matches it. Task 1 adds `css: { include: [/\/assets\/styles\/.+\.css/] }`. `.vue?raw` and `index.html?raw` work without it;
  - `import.meta.glob(..., )` keys list files without loading them, which lets a test check that a file exists or is gone;
  - `vi.stubEnv('DEV', false)` switches `import.meta.env.DEV` off;
  - `vi.spyOn(Storage.prototype, 'setItem')` does **not** intercept happy-dom's `localStorage`. Use `vi.spyOn(localStorage, 'setItem')`;
  - happy-dom has no `PromiseRejectionEvent`. Dispatch an `Event('unhandledrejection', { cancelable: true })` with a `reason` property defined on it;
  - with `no-console: 'error'`, even `expect(console.error)` in a test is flagged. Keep the spy in a variable (`const log = vi.spyOn(console, 'error')`).
- **Dry run:** every code block below was dry-run on a scratch clone of this branch, with one commit per task, including the font conversion.
  - After each task, test, typecheck, lint and build were green, with the test counts below. Each red phase was checked on the previous state.
  - Final state: **424 tests**, typecheck clean, lint with **0 problems**, build OK and `npx depcheck` → `No depcheck issue`.
  - The existing Playwright suite ran on the final dry-run build: Chromium **41/41**, WebKit **42/42**, with no CSP violation.
  - A probe of the new Lot 5 checks passed in both engines:
    - the two fonts load as woff2 with 200, and the page has no 4xx;
    - `body` is `overflow: hidden` while the login dialog is open;
    - a rejection shows the generic toast in `rgb(192, 57, 43)` / white, in Nunito Sans;
    - axe reports no `color-contrast` violation with the toast shown; only a `moderate` `region` finding on the toast body;
    - no `Authorization` in the console.
  - **Lighthouse 12 performance**, on a local `vite preview` of the landing page:

    | | Mobile | Desktop | Transferred |
    |---|---|---|---|
    | Before | 69 (FCP/LCP 5.0 s) | 98 | 779 KiB |
    | After | **96** (FCP/LCP 2.3 s) | **100** | 245 KiB |

    So lazy-loading the composer route was not needed.

## File map

| File | Action | Task | Responsibility |
|---|---|---|---|
| `src/assets/fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2`, `src/assets/fonts/Winky_Sans/WinkySans-Variable-Latin.woff2` | Create (binary) | 1 | Subset variable fonts |
| `src/assets/fonts/**/*.ttf`, `src/assets/fonts/*/README.txt` | Delete | 1 | 18 TTFs (4 variable, 14 static) and the Google Fonts READMEs; `OFL.txt` kept |
| `src/assets/styles/fonts.css` (+ `fonts.test.ts`, new) | Modify | 1 | Two `@font-face` in WOFF2, three utility classes |
| `vite.config.ts` | Modify | 1 | `test.css.include` for the stylesheet tests |
| `src/App.vue` | Modify | 1, 2 | `:root` without inert axes; `body.modal-open` |
| `src/assets/styles/toasts.css` (+ `toasts.test.ts`), `src/main.ts` | Create / Modify | 2, 4 | Toast palette; global error handler wired |
| `index.html`, `src/pageShell.test.ts` (new) | Modify / Create | 2 | Meta description, theme colour, Open Graph |
| `public/vite.svg`, `src/assets/vue.svg`, `src/style.css`, `src/types/svg.d.ts` | Delete | 2 | Unused Vite template leftovers |
| `src/utils/logError.ts` (+ test) | Create | 3 | Safe, DEV-only error log |
| `src/composables/useMastodonApi.ts` (+ test), `src/stores/scheduledToots.ts`, `src/stores/instance.ts`, `src/schemas/mastodon.ts`, `src/components/OAuthCallback.vue`, `src/components/MediaUpload.vue`, `src/components/Auth/LoginForm.vue`, `src/components/Toot/TootComposer.vue` | Modify | 3 | Every `console.*` replaced or removed |
| `eslint.config.js` | Modify | 3 | `no-console: 'error'`; Node globals for config files |
| `src/composables/useGlobalErrorHandler.ts` (+ test, + `useGlobalErrorHandler.mount.test.ts`) | Create | 4 | `errorHandler` + `unhandledrejection` + `error` → generic toast, deferred until the toast container mounts |
| `src/config/constants.ts` | Modify | 5 | `LANGUAGES`, `SUPPORTED_IMAGE_TYPES`, `DEFAULT_MAX_IMAGE_BYTES`, `DEFAULT_MAX_MEDIA_ATTACHMENTS` |
| `src/utils/media.ts` (+ test), `src/stores/instance.ts` (+ test), `src/stores/scheduledToots.ts`, `src/components/Toot/ScheduledToots.test.ts` | Modify | 5 | Constants moved; `DEFAULT_IMAGE_LIMITS`, `setLoading`, `instance.load` no longer exported |
| `src/components/ContentArea.vue`, `ControlsBar.vue`, `Toot/TootCard.vue`, `Toot/TootComposer.vue`, `MediaUpload.vue` (+ tests) | Modify | 5 | Shared languages; no `schedule-button` id; toggles; dead ternary |
| `src/stores/features.ts` (+ `features.test.ts`, new), `src/types/features.ts` | Modify | 6, 8 | Safe parse, `recentNewFeatures`, no `APP_VERSION`; release 0.16.1 |
| `package.json`, `package-lock.json` | Modify | 6, 8 | `@vueuse/*` removed; version 0.16.1 |
| `.claude/skills/changelog/SKILL.md`, `.claude/skills/vue3-codegen/SKILL.md` | Modify | 6 | Docs follow the renamed and removed symbols |
| `src/types/mastodon.ts`, `src/components/Toot/TootCard.vue`, `ScheduledToots.vue`, `TootComposer.vue` (+ tests), `src/utils/isOnlyScheduleChange.test.ts`, `src/stores/scheduledToots.test.ts` | Modify | 7 | Aligned `MastodonStatus`; one list request |
| `src/schemas/mastodon.ts` (+ test) | Modify | 7 (review) | `sensitive` read as Mastodon casts it at publish time |
| `README.md` | Modify | 8 | Features and Security lines |

Test count after each task: 384 → **389** (T1) → **400** (T2) → **408** (T3) → **417** (T4) → **420** (T5) → **430** (T6) → **438** (T7, with the review's `sensitive` fixes) → 438 (T8). Each task leaves typecheck, lint (0 errors) and tests green. (Planned: 388, 398, 404, 410, 413, 422, 424; the review fixes added the rest.)

---

### Task 1: Subset variable WOFF2 fonts; drop the TTFs (WEB-02)

**Goal:** The two font families ship as one subset variable WOFF2 each (Latin and Latin Extended), 128 KB in all instead of 1.34 MB, with no visible change. Every TTF, static or variable, leaves the repository.

**Files:**
- Create (binary): `src/assets/fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2`, `src/assets/fonts/Winky_Sans/WinkySans-Variable-Latin.woff2`
- Delete: the 4 variable TTFs, the 14 TTFs in `src/assets/fonts/Winky_Sans/static/`, and `src/assets/fonts/Nunito_Sans/README.txt` and `src/assets/fonts/Winky_Sans/README.txt` (they describe the TTFs). Keep both `OFL.txt` files
- Modify: `src/assets/styles/fonts.css` (whole file)
- Create: `src/assets/styles/fonts.test.ts`
- Modify: `vite.config.ts` (`test.css`)
- Modify: `src/App.vue` (`:root`, 3 lines)

**Acceptance Criteria:**
- [ ] `fonts.css` declares exactly two `@font-face`, both `format('woff2')`:
  - Nunito Sans: `font-weight: 200 1000`, normal style;
  - Winky Sans: `font-weight: 300 900`, normal style;
  - both `font-display: swap`.

  Only `.winky-sans-500`, `.winky-sans-700` and `.winky-sans-900` remain as utility classes
- [ ] No `.ttf`, `.otf` or `.woff` file remains under `src/assets/fonts/`, and each family keeps its `OFL.txt`
- [ ] The Nunito Sans file keeps the `wght` (200–1000) and `opsz` (6–12) axes; `wdth` and `YTLC` are pinned at 100 and 500. Winky Sans keeps `wght` (300–900). Both are subset to Latin and Latin Extended with all OpenType layout features
- [ ] `npm run build` puts exactly two `.woff2` files and no `.ttf` in `dist/assets`, under 300 KB together (127,568 bytes in the dry run; shipped: 129,704 bytes)
- [ ] `:root` in `App.vue` no longer sets `font-variation-settings` (the axes are gone; `font-optical-sizing: auto` stays)
- [ ] typecheck, lint (0 errors) and build pass; `npm test` passes with 389 tests

**Verify:** `npx vitest run src/assets/styles/fonts.test.ts` → `Tests  5 passed (5)`, then `npm run build && ls -l dist/assets/*.woff2 | awk '{s+=$5} END {print s}'` → about `129704` (127568 in the dry run)

**Steps:**

- [ ] **Step 1: Write the failing test**

1. In `vite.config.ts`, inside `test: { ... }`, add this after the `include: ['src/**/*.test.ts'],` line:

```ts
    // The global stylesheets are read as text by their tests (`?raw`); other CSS stays skipped.
    css: { include: [/\/assets\/styles\/.+\.css/] },
```

2. Create `src/assets/styles/fonts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fontsCss from './fonts.css?raw';

/** Every file under src/assets/fonts, by path (not loaded: only the names are read). */
const fontFiles = Object.keys(import.meta.glob('../fonts/**/*'));

describe('fonts', () => {
  it('loads only WOFF2 files, one per family', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);

    expect(urls).toEqual([
      '../fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2',
      '../fonts/Winky_Sans/WinkySans-Variable-Latin.woff2',
    ]);
    expect(fontsCss).not.toMatch(/truetype/);
    expect([...fontsCss.matchAll(/format\('([^']+)'\)/g)].map(match => match[1])).toEqual(['woff2', 'woff2']);
  });

  it('points at files that exist', () => {
    const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map(match => match[1]);

    for (const url of urls) expect(fontFiles).toContain(url);
  });

  it('keeps no TrueType, OpenType or WOFF 1 file in the repository', () => {
    expect(fontFiles.filter(path => /\.(ttf|otf|woff)$/i.test(path))).toEqual([]);
  });

  it('keeps the licence next to each font', () => {
    expect(fontFiles).toContain('../fonts/Nunito_Sans/OFL.txt');
    expect(fontFiles).toContain('../fonts/Winky_Sans/OFL.txt');
  });
});
```

Run: `npx vitest run src/assets/styles/fonts.test.ts`

Expected: `Tests  2 failed | 2 passed (4)`. "loads only WOFF2 files" and "keeps no TrueType…" fail. Without the `test.css` line, `fontsCss` would be an empty string and the first test would fail for the wrong reason.

- [ ] **Step 2: Make the WOFF2 files**

Run from the repository root. The venv goes to a temporary folder, never into the repo:

```bash
FONT_VENV="$(mktemp -d)/fontvenv"
python3 -m venv "$FONT_VENV"
"$FONT_VENV/bin/pip" install --quiet 'fonttools==4.66.1' 'brotli==1.2.0'

F=src/assets/fonts
TMP="$(mktemp -d)"
# Latin + Latin Extended (Google Fonts' "latin" and "latin-ext" ranges, merged).
UNICODES="U+0000-00FF,U+0100-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1EFF,U+2000-206F,U+20A0-20C0,U+2113,U+2122,U+2191,U+2193,U+2212,U+2215,U+2C60-2C7F,U+A720-A7FF,U+FEFF,U+FFFD"

# Nunito Sans: pin wdth and YTLC to the values the CSS always used; keep wght and opsz.
"$FONT_VENV/bin/fonttools" varLib.instancer "$F/Nunito_Sans/NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf" \
  wdth=100 YTLC=500 --output "$TMP/nunito.ttf" --quiet
"$FONT_VENV/bin/pyftsubset" "$TMP/nunito.ttf" --unicodes="$UNICODES" --layout-features='*' \
  --flavor=woff2 --output-file="$F/Nunito_Sans/NunitoSans-Variable-Latin.woff2"

# Winky Sans: one axis (wght), kept.
"$FONT_VENV/bin/pyftsubset" "$F/Winky_Sans/WinkySans-VariableFont_wght.ttf" --unicodes="$UNICODES" --layout-features='*' \
  --flavor=woff2 --output-file="$F/Winky_Sans/WinkySans-Variable-Latin.woff2"

ls -l "$F"/*/*.woff2
"$FONT_VENV/bin/python" -c "
from fontTools.ttLib import TTFont
for p in ['$F/Nunito_Sans/NunitoSans-Variable-Latin.woff2', '$F/Winky_Sans/WinkySans-Variable-Latin.woff2']:
    f = TTFont(p)
    print(p.split('/')[-1], f.flavor, [(a.axisTag, a.minValue, a.maxValue) for a in f['fvar'].axes])"
```

Expected:
- `NunitoSans-Variable-Latin.woff2` is about 80,690 bytes (80,688 in the dry run; it can differ by a few bytes) and `WinkySans-Variable-Latin.woff2` is 46,880 bytes;
- the check prints:

```
NunitoSans-Variable-Latin.woff2 woff2 [('wght', 200.0, 1000.0), ('opsz', 6.0, 12.0)]
WinkySans-Variable-Latin.woff2 woff2 [('wght', 300.0, 900.0)]
```

If `pip` cannot reach PyPI, stop and report it: only this venv route was dry-run. glyphhanger also drives fontTools, but it was not tried.

- [ ] **Step 3: Rewrite `src/assets/styles/fonts.css`**

Replace the whole file with:

```css
/*
 * Self-hosted variable fonts, WOFF2, subset to Latin and Latin Extended (plan 2026-10-08, Lot 5).
 * Made with fontTools 4.66 + brotli from the Google Fonts variable TTFs:
 * - Nunito Sans: `fonttools varLib.instancer ... wdth=100 YTLC=500` (the values the app always used),
 *   keeping the wght (200–1000) and opsz axes, then `pyftsubset --flavor=woff2`;
 * - Winky Sans: `pyftsubset --flavor=woff2` (wght 300–900).
 * No italic: the app never sets italic text. Other scripts (Cyrillic, Greek...) use the system font.
 */
@font-face {
  font-family: "Nunito Sans";
  src: url('../fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2') format('woff2');
  font-weight: 200 1000;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Winky Sans";
  src: url('../fonts/Winky_Sans/WinkySans-Variable-Latin.woff2') format('woff2');
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}

/* Winky Sans utility classes (the weights the templates use) */
.winky-sans-500 {
  font-family: "Winky Sans", sans-serif;
  font-weight: 500;
}

.winky-sans-700 {
  font-family: "Winky Sans", sans-serif;
  font-weight: 700;
}

.winky-sans-900 {
  font-family: "Winky Sans", sans-serif;
  font-weight: 900;
}
```

Before relying on that list, check that no other font class is used. Run `grep -rnoE "(nunito|winky)-sans(-[a-z0-9]+)?" src --include='*.vue' --include='*.ts' | sed 's/.*://' | sort | uniq -c`. Expected: only `winky-sans-500` (1), `winky-sans-700` (10) and `winky-sans-900` (2).

- [ ] **Step 4: Delete the TTFs and their READMEs**

```bash
git rm -q "src/assets/fonts/Nunito_Sans/NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf" \
  "src/assets/fonts/Nunito_Sans/NunitoSans-Italic-VariableFont_YTLC,opsz,wdth,wght.ttf" \
  src/assets/fonts/Nunito_Sans/README.txt \
  src/assets/fonts/Winky_Sans/WinkySans-VariableFont_wght.ttf \
  src/assets/fonts/Winky_Sans/WinkySans-Italic-VariableFont_wght.ttf \
  src/assets/fonts/Winky_Sans/README.txt
git rm -q -r src/assets/fonts/Winky_Sans/static
git ls-files src/assets/fonts
```

Expected: only the two `OFL.txt` files are listed. The new `.woff2` files are not staged yet. Ignored `.DS_Store` files may remain on disk, which is harmless.

- [ ] **Step 5: Drop the inert axis settings from `:root`**

In `src/App.vue`, in the unscoped `<style>` block, replace:

```css
  font-optical-sizing: auto;
  font-variation-settings:
    "wdth" 100,
    "YTLC" 500;

  font-synthesis: none;
```

with:

```css
  font-optical-sizing: auto;

  font-synthesis: none;
```

`src/style.css` holds the same lines, but it is never imported; Task 2 deletes it.

- [ ] **Step 6: Run the checks**

```bash
npx vitest run src/assets/styles/fonts.test.ts
npm run typecheck && npm run lint && npm test
npm run build
ls -l dist/assets | grep -E 'woff|ttf'
ls -l dist/assets/*.woff2 | awk '{s+=$5} END {print s}'
```

Expected:
- `Tests  5 passed (5)`;
- typecheck exits 0;
- lint: `0 errors` (4 warnings, as before);
- `Tests  389 passed (389)`;
- the build lists `WinkySans-Variable-Latin-*.woff2 46.88 kB` and `NunitoSans-Variable-Latin-*.woff2 80.69 kB`, and no `.ttf`;
- the sum is about `129704` (127568 in the dry run).

- [ ] **Step 7: Commit**

```bash
git add src/assets/fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2 src/assets/fonts/Winky_Sans/WinkySans-Variable-Latin.woff2 src/assets/styles/fonts.css src/assets/styles/fonts.test.ts vite.config.ts src/App.vue
git commit -m "perf(fonts): self-host subset variable WOFF2 (latin + latin-ext), drop the TTFs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/assets/fonts/Nunito_Sans/NunitoSans-Variable-Latin.woff2", "src/assets/fonts/Winky_Sans/WinkySans-Variable-Latin.woff2", "src/assets/styles/fonts.css", "src/assets/styles/fonts.test.ts", "vite.config.ts", "src/App.vue"], "verifyCommand": "npx vitest run src/assets/styles/fonts.test.ts", "acceptanceCriteria": ["two woff2 @font-face, three utility classes", "no ttf/otf/woff left, OFL kept", "Nunito keeps wght+opsz with wdth/YTLC pinned; Winky keeps wght; latin + latin-ext", "dist: two woff2, no ttf, under 300 KB", "no font-variation-settings in :root", "388 tests"], "requiresUserVerification": false}
```

---

### Task 2: Page shell and global styles: scroll lock, readable toasts, meta, no template leftovers (WEB-06, carry-overs)

**Goal:** The global rules reach production:
- the dialog scroll lock, which Lot 4 wrote into a stylesheet that is never imported;
- toast colours from the app's palette, all at least 4.5:1.

The page also describes itself to search engines and link previews, and the Vite template leftovers are gone.

**Files:**
- Create: `src/assets/styles/toasts.css`, `src/assets/styles/toasts.test.ts`
- Modify: `src/main.ts` (one import)
- Modify: `src/App.vue` (`body.modal-open` in the unscoped `<style>`)
- Modify: `index.html` (whole file)
- Create: `src/pageShell.test.ts`
- Delete: `public/vite.svg`, `src/assets/vue.svg`, `src/style.css`, `src/types/svg.d.ts`

**Acceptance Criteria:**
- [ ] The production CSS contains `body.modal-open{overflow:hidden}`. **Before this task it did not:** the dry run built the Task 1 state and found no `modal-open` rule in `dist/assets/*.css`, so the scroll lock was broken in production. ModalView has set the class since Lot 4, and `src/style.css`, where the rule was written, is imported nowhere
- [ ] `src/style.css` is deleted
- [ ] Toasts use palette colours only (ui-design-system):

  | Toast | Background | Text | Contrast |
  |---|---|---|---|
  | default, success | `#333` | `#fff` | 12.6:1 |
  | info | `#2577b1` | `#fff` | 4.8:1 |
  | warning | `#FF9200` | `#333` | 5.6:1 |
  | error | `#c0392b` | `#fff` | 5.4:1 |

  The close button takes the text colour at 0.8 opacity, which keeps it at 3:1 or more as large text (24 px bold). Toasts use the app's font. The library's defaults, such as white on `#4caf50` (2.8:1) and white on `#ffc107` (1.6:1), are overridden with higher specificity, from a stylesheet: the CSP allows no inline style
- [ ] `index.html` has:
  - `<meta name="description">`;
  - `<meta name="theme-color" content="#ffffff">`, the header's colour;
  - `og:type`, `og:site_name`, `og:title`, `og:description` and `og:url` (`https://www.regulardesigner.com/toots-scheduler/`).

  The favicon stays the inline SVG emoji, which `img-src data:` allows
- [ ] `public/vite.svg`, `src/assets/vue.svg` and `src/types/svg.d.ts` are deleted: nothing references them, and `vite/client` already types `*.svg` imports
- [ ] typecheck, lint (0 errors) and build pass; `npm test` passes with 400 tests

**Verify:** `npx vitest run src/assets/styles/toasts.test.ts src/pageShell.test.ts` → `Tests  11 passed (11)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Create `src/assets/styles/toasts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import toastsCss from './toasts.css?raw';

/** WCAG relative luminance of a #rgb or #rrggbb colour. */
function luminance(hex: string): number {
  const value = hex.length === 4 ? hex.slice(1).split('').map(c => c + c).join('') : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `color` drawn at `opacity` over `background`, as the browser composites it. */
function blend(color: string, background: string, opacity: number): string {
  const channels = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const [fg, bg] = [channels(color), channels(background)];
  return '#' + fg.map((c, i) => Math.round(c * opacity + bg[i] * (1 - opacity)).toString(16).padStart(2, '0')).join('');
}

/** Long form (#333 → #333333), lower case. */
function normalize(hex: string): string {
  const value = hex.toLowerCase();
  return value.length === 4 ? '#' + value.slice(1).split('').map(c => c + c).join('') : value;
}

/** The colours set for one toast type, read from toasts.css. */
function colorsOf(type: string): { background: string; text: string } {
  const rule = toastsCss.match(new RegExp(`\\.Vue-Toastification__toast--${type}[^{]*\\{([^}]*)\\}`));
  if (!rule) throw new Error(`No rule for ${type} toasts`);
  const background = rule[1].match(/background-color:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
  const text = rule[1].match(/(?:^|[\s;])color:\s*(#[0-9a-fA-F]{3,6})/)?.[1];
  if (!background || !text) throw new Error(`Incomplete colours for ${type} toasts`);
  return { background: normalize(background), text: normalize(text) };
}

const TYPES = ['default', 'success', 'info', 'warning', 'error'];

describe('toast colours', () => {
  it.each(TYPES)('gives %s toasts text with at least 4.5:1 contrast', (type) => {
    const { background, text } = colorsOf(type);

    expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the close button (24px bold, large text) at 3:1 or more on every toast', () => {
    const opacity = Number(toastsCss.match(/__close-button\s*\{[^}]*opacity:\s*([\d.]+)/)?.[1]);
    expect(opacity).toBeGreaterThan(0);

    for (const type of TYPES) {
      const { background, text } = colorsOf(type);
      expect(contrast(blend(text, background, opacity), background)).toBeGreaterThanOrEqual(3);
    }
  });

  it('uses only colours from the design system palette', () => {
    const palette = ['#333333', '#ffffff', '#2577b1', '#ff9200', '#c0392b'];
    const rules = toastsCss.replace(/\/\*[\s\S]*?\*\//g, ''); // comments name the library's old colours
    const used = [...rules.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map(match => normalize(match[0]));

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(color => !palette.includes(color))).toEqual([]);
  });
});
```

2. Create `src/pageShell.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import indexHtml from '../index.html?raw';
import appSfc from './App.vue?raw';

/** Every file in public/ and src/, by path from this folder (not loaded: only the names are read). */
const files = Object.keys(import.meta.glob(['../public/**/*', './**/*', '!./**/*.test.ts']));

function meta(attribute: 'name' | 'property', key: string): string | undefined {
  return indexHtml.match(new RegExp(`<meta ${attribute}="${key}" content="([^"]+)"`))?.[1];
}

describe('page shell', () => {
  it('describes the app for search engines and link previews', () => {
    expect(meta('name', 'description')).toMatch(/^Schedule your Mastodon toots/);
    expect(meta('name', 'theme-color')).toBe('#ffffff');
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:title')).toBe('Toot Scheduler');
    expect(meta('property', 'og:description')).toMatch(/^Schedule your Mastodon toots/);
    expect(meta('property', 'og:url')).toBe('https://www.regulardesigner.com/toots-scheduler/');
  });

  it('keeps no leftover from the Vite template', () => {
    expect(files).not.toContain('../public/vite.svg');
    expect(files).not.toContain('./assets/vue.svg');
    expect(files).not.toContain('./style.css');
    expect(indexHtml).not.toContain('vite.svg');
  });

  it('locks page scroll behind a dialog from the global stylesheet that ships', () => {
    // App.vue's unscoped <style> is the app's global stylesheet; ModalView sets body.modal-open.
    const globalStyle = appSfc.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

    expect(globalStyle).toMatch(/body\.modal-open\s*\{\s*overflow:\s*hidden;\s*\}/);
  });
});
```

Run: `npx vitest run src/assets/styles/toasts.test.ts src/pageShell.test.ts`

Expected: `Test Files  2 failed (2)` and `Tests  3 failed (3)`:
- `toasts.test.ts` cannot resolve `./toasts.css?raw`;
- the three page-shell tests fail.

- [ ] **Step 2: Restyle the toasts**

Create `src/assets/styles/toasts.css`:

```css
/*
 * Toast colours from the app's palette (ui-design-system), replacing vue-toastification's defaults,
 * whose white text fails WCAG AA (white on #4caf50 is 2.8:1, on #ffc107 1.6:1).
 * Every pair below is at least 4.5:1; toasts.test.ts checks it.
 * Kept in a stylesheet: the CSP allows no inline style.
 */
.Vue-Toastification__container .Vue-Toastification__toast {
  font-family: inherit;
}

.Vue-Toastification__container .Vue-Toastification__toast--default,
.Vue-Toastification__container .Vue-Toastification__toast--success {
  background-color: #333;
  color: #fff;
}

.Vue-Toastification__container .Vue-Toastification__toast--info {
  background-color: #2577b1;
  color: #fff;
}

.Vue-Toastification__container .Vue-Toastification__toast--warning {
  background-color: #FF9200;
  color: #333;
}

.Vue-Toastification__container .Vue-Toastification__toast--error {
  background-color: #c0392b;
  color: #fff;
}

/* The close button takes the toast's text colour; the library's 0.3 opacity made it unreadable. */
.Vue-Toastification__container .Vue-Toastification__close-button {
  color: inherit;
  opacity: 0.8;
}

.Vue-Toastification__container .Vue-Toastification__close-button:hover,
.Vue-Toastification__container .Vue-Toastification__close-button:focus {
  opacity: 1;
}
```

In `src/main.ts`, replace:

```ts
import 'vue-toastification/dist/index.css'
```

with:

```ts
import 'vue-toastification/dist/index.css'
// After the library's stylesheet: readable colours from the app's palette.
import './assets/styles/toasts.css'
```

The `.Vue-Toastification__container` prefix wins over the library's single-class rules whatever the bundle order.

- [ ] **Step 3: Move the scroll lock into the stylesheet that ships**

In `src/App.vue`, in the unscoped `<style>` block, replace:

```css
/* Hidden on screen, still read by screen readers (labels of icon-only controls, live regions). */
```

with:

```css
/* Page scroll is locked while a dialog is open (class set by ModalView). */
body.modal-open {
  overflow: hidden;
}

/* Hidden on screen, still read by screen readers (labels of icon-only controls, live regions). */
```

- [ ] **Step 4: Describe the page**

Replace the whole `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏰</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Toot Scheduler</title>
    <meta name="description" content="Schedule your Mastodon toots: write now, pick a date and time, and your instance publishes them for you. Free, open source, no account to create." />
    <meta name="theme-color" content="#ffffff" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Toot Scheduler" />
    <meta property="og:title" content="Toot Scheduler" />
    <meta property="og:description" content="Schedule your Mastodon toots: write now, pick a date and time, and your instance publishes them for you." />
    <meta property="og:url" content="https://www.regulardesigner.com/toots-scheduler/" />
    <script src="/spa-redirect.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

The CSP is still added at build time by the `content-security-policy` plugin in `vite.config.ts`.

- [ ] **Step 5: Delete the leftovers**

First confirm that nothing uses them. Run `grep -rnE "vite\.svg|vue\.svg|style\.css|from '[^']*\.svg'" src index.html public --include='*.ts' --include='*.vue' --include='*.html' --include='*.css'`. Expected: no output.

```bash
git rm -q public/vite.svg src/assets/vue.svg src/style.css src/types/svg.d.ts
```

- [ ] **Step 6: Run the checks**

```bash
npx vitest run src/assets/styles/toasts.test.ts src/pageShell.test.ts
npm run typecheck && npm run lint && npm test
npm run build
grep -o "body.modal-open{[^}]*}" dist/assets/*.css
grep -o "Vue-Toastification__container .Vue-Toastification__toast--success{[^}]*}" dist/assets/*.css
```

Expected:
- `Tests  11 passed (11)`;
- typecheck exits 0;
- `0 errors` (4 warnings);
- `Tests  400 passed (400)`;
- `…index-*.css:body.modal-open{overflow:hidden}`;
- `…:Vue-Toastification__container .Vue-Toastification__toast--success{background-color:#333;color:#fff}`.

- [ ] **Step 7: Commit**

```bash
git add src/assets/styles/toasts.css src/assets/styles/toasts.test.ts src/main.ts src/App.vue index.html src/pageShell.test.ts
git commit -m "fix(ui): restore the dialog scroll lock, readable toasts, page meta; drop Vite template leftovers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The four deletions were staged by `git rm` in Step 5.)

```json:metadata
{"files": ["src/assets/styles/toasts.css", "src/assets/styles/toasts.test.ts", "src/main.ts", "src/App.vue", "index.html", "src/pageShell.test.ts", "public/vite.svg", "src/assets/vue.svg", "src/style.css", "src/types/svg.d.ts"], "verifyCommand": "npx vitest run src/assets/styles/toasts.test.ts src/pageShell.test.ts", "acceptanceCriteria": ["body.modal-open in the shipped CSS (it was missing), style.css deleted", "toasts in palette colours, all >= 4.5:1, close button >= 3:1, app font", "meta description, theme-color, minimal Open Graph", "vite.svg, vue.svg, svg.d.ts deleted", "398 tests"], "requiresUserVerification": false}
```

---

### Task 3: `logError`: DEV-only one-line logs, never the bearer token (carry-over, web-security §2 and §6)

**Goal:** Every error the app logs goes through `logError(context, error)`. It prints one line in DEV only: the message, the HTTP status and code, and the causes. It never prints the request config, its headers (`Authorization: Bearer …`) or the response body. Today `console.error(..., error)` hands DevTools the whole Error, and its `cause` is an AxiosError whose `config.headers.Authorization` holds the token. ESLint now forbids any other console call.

**Files:**
- Create: `src/utils/logError.ts`, `src/utils/logError.test.ts`
- Modify: `src/composables/useMastodonApi.ts` (2 calls), `src/composables/useMastodonApi.test.ts` (1 test)
- Modify: `src/stores/scheduledToots.ts` (3), `src/stores/instance.ts` (1), `src/schemas/mastodon.ts` (1)
- Modify: `src/components/OAuthCallback.vue` (1), `src/components/MediaUpload.vue` (2), `src/components/Auth/LoginForm.vue` (1), `src/components/Toot/TootComposer.vue` (2 `console.error`, and 2 `console.log` removed: they printed the account)
- Modify: `eslint.config.js`

**Acceptance Criteria:**
- [ ] `describeError(error)` returns:
  - for an AxiosError: `AxiosError: <message>[, status N][, code X]`, and nothing from its config, headers or response body;
  - for another Error: `<name>: <message>`, plus ` (cause: …)`, following at most 3 causes;
  - for anything else: `A non-error value was thrown (<typeof>)`, never the value itself
- [ ] `logError(context, error)` calls `console.error` once, with the single string `` `${context}: ${describeError(error)}` ``, and only when `import.meta.env.DEV`. Production builds drop the console anyway (`esbuild.drop`, Lot 2)
- [ ] No `console.` call is left in `src/` outside `logError.ts`, and the two `console.log` calls in TootComposer that printed the account are removed
- [ ] `eslint.config.js`:
  - `'no-console': 'error'`, with one `eslint-disable-next-line` in `logError.ts`;
  - a block `{ files: ['*.config.{js,ts}'], languageOptions: { globals: globals.node } }`
- [ ] A failed `deleteScheduledToot` logs `Error deleting scheduled toot: AxiosError: Request failed with status code 404, status 404, code ERR_BAD_REQUEST`, and the token string appears in no logged argument
- [ ] typecheck, lint (0 errors, 2 warnings left) and build pass; `npm test` passes with 408 tests

**Verify:** `npx vitest run src/utils/logError.test.ts src/composables/useMastodonApi.test.ts` → `Tests  37 passed (37)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. Create `src/utils/logError.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { describeError, logError } from './logError';

/** A 401 from the instance, as axios builds it: the request config carries the bearer token. */
function unauthorized(): AxiosError {
  const config = { url: 'https://masto.example/api/v1/scheduled_statuses', headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) } as InternalAxiosRequestConfig;
  const response = { status: 401, statusText: 'Unauthorized', data: { error: 'The access token is invalid' }, headers: {}, config } as AxiosResponse;
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, response);
}

describe('logError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs a one-line summary of an API failure, never the request headers', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // What useMastodonApi throws: the instance's message, with the AxiosError as its cause.
    const error = new Error('The access token is invalid', { cause: unauthorized() });

    logError('Error fetching scheduled toots', error);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual([
      'Error fetching scheduled toots: Error: The access token is invalid (cause: AxiosError: Request failed with status code 401, status 401, code ERR_BAD_REQUEST)',
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('logs nothing in production', () => {
    vi.stubEnv('DEV', false);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    logError('Upload error', new Error('Boom'));

    expect(log).not.toHaveBeenCalled();
  });
});

describe('describeError', () => {
  it('describes an AxiosError by its message, status and code only', () => {
    expect(describeError(unauthorized())).toBe('AxiosError: Request failed with status code 401, status 401, code ERR_BAD_REQUEST');
    expect(describeError(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe('AxiosError: Network Error, code ERR_NETWORK');
  });

  it('describes other errors by name and message, following a bounded chain of causes', () => {
    expect(describeError(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');

    const looped = new Error('Outer');
    looped.cause = looped;
    expect(describeError(looped)).toBe('Error: Outer (cause: Error: Outer (cause: Error: Outer (cause: Error: Outer)))');
  });

  it('never prints a value that is not an Error', () => {
    expect(describeError({ headers: { Authorization: 'Bearer secret-token' } })).toBe('A non-error value was thrown (object)');
    expect(describeError('Bearer secret-token')).toBe('A non-error value was thrown (string)');
  });
});
```

2. In `src/composables/useMastodonApi.test.ts`, replace `import axios from 'axios';` with:

```ts
import axios, { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
```

Then, in `describe('deleteScheduledToot', ...)`, add this test after `it('encodes the id in the path', ...)`:

```ts
    it('logs a failure without the bearer token the request carried', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const config = { headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }) } as InternalAxiosRequestConfig;
      const response = { status: 404, statusText: 'Not Found', data: { error: 'Record not found' }, headers: {}, config } as AxiosResponse;
      http.delete.mockRejectedValue(new AxiosError('Request failed with status code 404', 'ERR_BAD_REQUEST', config, null, response));

      await expect(useMastodonApi().deleteScheduledToot('1')).rejects.toThrow('Record not found');

      expect(log).toHaveBeenCalledWith('Error deleting scheduled toot: AxiosError: Request failed with status code 404, status 404, code ERR_BAD_REQUEST');
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
      log.mockRestore();
    });
```

Run: `npx vitest run src/utils/logError.test.ts src/composables/useMastodonApi.test.ts`

Expected:
- `logError.test.ts` fails: `Failed to resolve import "./logError"`;
- the new API test fails: the logged arguments are the message and the AxiosError, and they contain `secret-token`.

- [ ] **Step 2: Implement `logError`**

Create `src/utils/logError.ts`:

```ts
import axios from 'axios';

/** How many causes are followed: enough for a wrapped API error, bounded for a cycle. */
const MAX_CAUSE_DEPTH = 3;

/**
 * A short description of what was thrown, safe for the console. An AxiosError holds the request
 * config, headers included (`Authorization: Bearer …`), and the response body: only its message,
 * HTTP status and error code are kept. A value that is not an Error is not printed at all.
 * @param {unknown} error - What was thrown; often an Error whose `cause` is the AxiosError.
 * @param {number} [depth] - Causes already followed (internal).
 * @returns {string} e.g. `Error: Not found (cause: AxiosError: Request failed with status code 404, status 404, code ERR_BAD_REQUEST)`.
 */
export function describeError(error: unknown, depth = 0): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return [`AxiosError: ${error.message}`, status ? `status ${status}` : '', error.code ? `code ${error.code}` : '']
      .filter(Boolean)
      .join(', ');
  }
  if (error instanceof Error) {
    const cause = error.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? ` (cause: ${describeError(error.cause, depth + 1)})`
      : '';
    return `${error.name}: ${error.message}${cause}`;
  }
  return `A non-error value was thrown (${typeof error})`;
}

/**
 * Logs an error for developers, in DEV only (production builds drop the console anyway).
 * The only console output of the app: never pass a request, a response or a token to the console directly.
 * @param {string} context - What failed, e.g. "Upload error".
 * @param {unknown} error - What was thrown.
 */
export function logError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  // eslint-disable-next-line no-console -- the one sanctioned console call, see above
  console.error(`${context}: ${describeError(error)}`);
}
```

- [ ] **Step 3: Replace every console call**

Each file gets one import, placed after its last relative import as shown, and each call is replaced one for one.

1. `src/composables/useMastodonApi.ts`:
   - after `import { getNextPageUrl } from '../utils/linkHeader';`, add `import { logError } from '../utils/logError';`;
   - replace `      console.error('Error fetching scheduled toots:', error);` with `      logError('Error fetching scheduled toots', error);`;
   - replace `      console.error('Error deleting scheduled toot:', err);` with `      logError('Error deleting scheduled toot', err);`.
2. `src/stores/scheduledToots.ts`:
   - after `import { isOnlyScheduleChange } from '../utils/isOnlyScheduleChange';`, add `import { logError } from '../utils/logError';`;
   - replace `console.error('Error fetching scheduled toots:', err);` with `logError('Error fetching scheduled toots', err);`;
   - replace `console.error('Error deleting the previous version of an edited toot:', err);` with `logError('Error deleting the previous version of an edited toot', err);`;
   - replace `console.error('Error updating toot:', err);` with `logError('Error updating toot', err);`.
3. `src/stores/instance.ts`:
   - after `import { DEFAULT_MAX_CHARACTERS } from '../config/constants';`, add `import { logError } from '../utils/logError';`;
   - replace `console.error('Could not read the instance limits, using the defaults:', error);` with `logError('Could not read the instance limits, using the defaults', error);`.
4. `src/schemas/mastodon.ts`:
   - after `import { isValid, parseISO } from 'date-fns';`, add `import { logError } from '../utils/logError';`;
   - replace ``    console.error(`Unexpected ${what} from the instance:`, result.error.issues);`` with ``    logError(`Unexpected ${what} from the instance`, result.error);``. The ZodError's message lists the issues.
5. `src/components/OAuthCallback.vue`:
   - after `import { readAuthorizationCode, takePendingLogin } from '../utils/oauthFlow';`, add `import { logError } from '../utils/logError';`;
   - replace `    console.error('OAuth callback error:', err);` with `    logError('OAuth callback error', err);`.
6. `src/components/MediaUpload.vue`:
   - before `import { acceptedImageFiles, describeImageTypes, formatMegabytes, getImageRejection, type ImageLimits } from '../utils/media';`, add `import { logError } from '../utils/logError';`;
   - replace `    console.error('Upload error:', err);` with `    logError('Upload error', err);`;
   - replace `    console.error('Error updating media metadata:', err);` with `    logError('Error updating media metadata', err);`.
7. `src/components/Auth/LoginForm.vue`:
   - after `import { buildAuthorizeUrl, savePendingLogin } from '../../utils/oauthFlow';`, add `import { logError } from '../../utils/logError';`;
   - replace `    console.error('Login error:', err);` with `    logError('Login error', err);`.
8. `src/components/Toot/TootComposer.vue`:
   - after `import { buildScheduledToot } from '../../utils/buildScheduledToot';`, add `import { logError } from '../../utils/logError';`;
   - in `onMounted`, delete the line `  console.log('Initial auth account:', auth.account);` and the line `      console.log('Fetched account:', accountData);`;
   - replace `      console.error('Error fetching user info:', err);` with `      logError('Error fetching user info', err);`;
   - replace `    console.error('Error scheduling toot:', err);` with `    logError('Error scheduling toot', err);`.

- [ ] **Step 4: ESLint: no console; Node globals for config files**

In `eslint.config.js`, replace:

```js
      // Tracked for Lot 2 (dev-only logger) and Lot 3 (typed API responses).
      'no-console': ['warn', { allow: ['error'] }],
```

with:

```js
      // Errors are logged with src/utils/logError.ts only: DEV only, and never a request's headers (the token).
      'no-console': 'error',
```

Then add a last block to the config, before the closing `)`:

```js
  // Config files run in Node, not in the browser.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
```

The end of the file now reads:

```js
      'vue/multi-word-component-names': 'off',
    },
  },
  // Config files run in Node, not in the browser.
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
)
```

- [ ] **Step 5: Run the checks**

```bash
npx vitest run src/utils/logError.test.ts src/composables/useMastodonApi.test.ts
grep -rn "console\." src --include='*.ts' --include='*.vue' | grep -v "\.test\.ts"
npm run typecheck && npm run lint && npm test
npm run build && grep -c "console\." dist/assets/index-*.js
```

Expected:
- `Tests  37 passed (37)`;
- the grep lists only `src/utils/logError.ts` (its JSDoc line and its `console.error`);
- typecheck exits 0;
- `0 errors, 2 warnings`: TootCard's `spoiler_text` prop casing and the `any` in `types/mastodon.ts`, both fixed in Task 7;
- `Tests  408 passed (408)`;
- `0`: no console call in the production bundle.

To check that the rule bites, run `echo "console.error('x');" >> src/utils/url.ts && npx eslint src/utils/url.ts; git checkout src/utils/url.ts`. Expected: `error  Unexpected console statement  no-console`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/logError.ts src/utils/logError.test.ts src/composables/useMastodonApi.ts src/composables/useMastodonApi.test.ts src/stores/scheduledToots.ts src/stores/instance.ts src/schemas/mastodon.ts src/components/OAuthCallback.vue src/components/MediaUpload.vue src/components/Auth/LoginForm.vue src/components/Toot/TootComposer.vue eslint.config.js
git commit -m "fix(security): log errors through logError, DEV only and never the bearer token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/utils/logError.ts", "src/utils/logError.test.ts", "src/composables/useMastodonApi.ts", "src/composables/useMastodonApi.test.ts", "src/stores/scheduledToots.ts", "src/stores/instance.ts", "src/schemas/mastodon.ts", "src/components/OAuthCallback.vue", "src/components/MediaUpload.vue", "src/components/Auth/LoginForm.vue", "src/components/Toot/TootComposer.vue", "eslint.config.js"], "verifyCommand": "npx vitest run src/utils/logError.test.ts src/composables/useMastodonApi.test.ts", "acceptanceCriteria": ["describeError: AxiosError message/status/code only, bounded causes, non-errors never printed", "logError: one string, DEV only", "no console call outside logError; account console.log removed", "no-console error; node globals for *.config", "API failure logged without the token", "404 tests"], "requiresUserVerification": false}
```

---

### Task 4: Global error handling: a generic toast, logged in DEV only (WEB-05)

**Goal:** An error that nothing else handled no longer fails in silence:
- an error thrown by a component, a hook, a watcher or an event handler reaches `app.config.errorHandler`;
- a promise rejected without a catch fires `unhandledrejection`.

Either way the user sees one generic error toast, and the error is logged through `logError` in DEV only.

**Files:**
- Create: `src/composables/useGlobalErrorHandler.ts`, `src/composables/useGlobalErrorHandler.test.ts`
- Modify: `src/main.ts`

**Acceptance Criteria:**
- [ ] `useGlobalErrorHandler(app, target = window)`:
  - sets `app.config.errorHandler`;
  - adds an `unhandledrejection` listener on `target`;
  - returns `{ uninstall }`, which removes the listener
- [ ] Both paths call `notify.error(GENERIC_ERROR_MESSAGE)`, which shows the toast and speaks it in the assertive live region (useNotify, Lot 4). A burst gives one toast: no second toast within 5 s
- [ ] Both paths log through `logError`: `Unhandled error (<info>): …` and `Unhandled promise rejection: …`. Nothing is logged in production, and a non-Error reason is never printed
- [ ] The rejection listener calls `event.preventDefault()`, so the browser does not print "Uncaught (in promise)" with the raw reason, which may be an AxiosError carrying the token
- [ ] `main.ts` installs it right after `app.use(Toast, …)` and before `app.mount`
- [ ] typecheck, lint (0 errors) and build pass; `npm test` passes with 417 tests

**Verify:** `npx vitest run src/composables/useGlobalErrorHandler.test.ts` → `Tests  8 passed (8)` (and `useGlobalErrorHandler.mount.test.ts` → `Tests  1 passed (1)`)

**Steps:**

- [ ] **Step 1: Write the failing test**

Create `src/composables/useGlobalErrorHandler.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { createApp, defineComponent, type App } from 'vue';

const notify = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./useNotify', () => ({ useNotify: () => notify }));

import { GENERIC_ERROR_MESSAGE, useGlobalErrorHandler } from './useGlobalErrorHandler';

/** A component whose setup throws, as a rendering bug would. */
const Broken = defineComponent({
  setup() {
    throw new Error('Boom');
  },
  render: () => null,
});

/** An unhandled rejection as the browser dispatches it (happy-dom has no PromiseRejectionEvent). */
function rejection(reason: unknown): Event {
  const event = new Event('unhandledrejection', { cancelable: true });
  Object.defineProperty(event, 'reason', { value: reason });
  return event;
}

let app: App | null = null;
let uninstall: (() => void) | null = null;
/** console.error, silenced: what the handler logs is read from here. */
let log: MockInstance<typeof console.error>;

function install(): App {
  app = createApp(Broken);
  uninstall = useGlobalErrorHandler(app).uninstall;
  return app;
}

describe('useGlobalErrorHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // Vue's own dev warnings
  });

  afterEach(() => {
    app?.unmount();
    app = null;
    uninstall?.();
    uninstall = null;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('shows the generic toast when a component throws, and logs a summary in DEV', () => {
    install().mount(document.createElement('div'));

    expect(notify.error).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(log).toHaveBeenCalledWith('Unhandled error (setup function): Error: Boom');
  });

  it('shows the generic toast for a promise rejected without a catch, and keeps the browser from logging it', () => {
    install();
    const event = rejection(new Error('Lost request'));

    window.dispatchEvent(event);

    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(event.defaultPrevented).toBe(true);
    expect(log).toHaveBeenCalledWith('Unhandled promise rejection: Error: Lost request');
  });

  it('never logs what was rejected when it is not an Error (a raw response, say)', () => {
    install();

    window.dispatchEvent(rejection({ config: { headers: { Authorization: 'Bearer secret-token' } } }));

    expect(JSON.stringify(log.mock.calls)).not.toContain('secret-token');
  });

  it('shows one toast for a burst of errors, then again after a pause', () => {
    vi.useFakeTimers();
    install();

    window.dispatchEvent(rejection(new Error('1')));
    window.dispatchEvent(rejection(new Error('2')));
    expect(notify.error).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    window.dispatchEvent(rejection(new Error('3')));
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it('logs nothing in production, and still tells the user', () => {
    vi.stubEnv('DEV', false);
    install();

    window.dispatchEvent(rejection(new Error('Lost request')));

    expect(notify.error).toHaveBeenCalledWith(GENERIC_ERROR_MESSAGE);
    expect(log).not.toHaveBeenCalled();
  });

  it('stops listening once uninstalled', () => {
    install();
    uninstall?.();

    window.dispatchEvent(rejection(new Error('Late')));

    expect(notify.error).not.toHaveBeenCalled();
  });
});
```

The root component is the broken one, which keeps the file to one component (`vue/one-component-per-file`). The spy is read from `log`, never as `console.error`, because `no-console` (Task 3) flags member access too.

Run: `npx vitest run src/composables/useGlobalErrorHandler.test.ts`

Expected: `Failed to resolve import "./useGlobalErrorHandler"`.

- [ ] **Step 2: Implement it**

Create `src/composables/useGlobalErrorHandler.ts`:

```ts
import type { App } from 'vue';
import { useNotify } from './useNotify';
import { logError } from '../utils/logError';

/** What the user is told when something fails that no part of the app handled. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again, or reload the page if it keeps happening.';

/** A burst of errors (a render loop, a failing timer) shows one toast, not dozens. */
const TOAST_INTERVAL_MS = 5000;

/**
 * Catches what nothing else handled, so a failure never leaves a blank page in silence:
 * errors thrown by components, hooks, watchers and event handlers (`app.config.errorHandler`),
 * and promises rejected without a catch (`unhandledrejection`). Each shows a generic toast
 * (at most one every 5 seconds) and is logged in DEV only, through logError.
 * The browser's own "Uncaught (in promise)" log is suppressed: the reason may be an AxiosError,
 * whose request headers hold the bearer token.
 * @param {App} app - The Vue application, before it is mounted.
 * @param {Window} [target] - Where unhandled rejections are listened for.
 * @returns {Object} `uninstall`, which stops listening for rejections.
 */
export function useGlobalErrorHandler(app: App, target: Window = window) {
  const notify = useNotify();
  let lastToastAt = -Infinity;

  function report(context: string, error: unknown): void {
    logError(context, error);
    const now = Date.now();
    if (now - lastToastAt < TOAST_INTERVAL_MS) return;
    lastToastAt = now;
    notify.error(GENERIC_ERROR_MESSAGE);
  }

  app.config.errorHandler = (error, _instance, info) => report(`Unhandled error (${info})`, error);

  function onUnhandledRejection(event: PromiseRejectionEvent): void {
    event.preventDefault();
    report('Unhandled promise rejection', event.reason);
  }
  target.addEventListener('unhandledrejection', onUnhandledRejection);

  return {
    uninstall: () => target.removeEventListener('unhandledrejection', onUnhandledRejection),
  };
}
```

`useNotify()` works outside a component: vue-toastification's `useToast()` then falls back to the plugin's global event bus, which the toast container listens to. Its announcer is module state (Lot 4).

- [ ] **Step 3: Install it in `main.ts`**

In `src/main.ts`, replace `import router from './router'` with:

```ts
import router from './router'
import { useGlobalErrorHandler } from './composables/useGlobalErrorHandler'
```

and replace `app.use(Toast, toastOptions)` with:

```ts
app.use(Toast, toastOptions)
// A failure nothing else handled shows a toast instead of a blank page (logged in DEV only).
useGlobalErrorHandler(app)
```

- [ ] **Step 4: Run the checks**

```bash
npx vitest run src/composables/useGlobalErrorHandler.test.ts
npm run typecheck && npm run lint && npm test
npm run build
```

Expected:
- `Tests  8 passed (8)`;
- typecheck exits 0;
- `0 errors, 2 warnings`;
- `Tests  417 passed (417)`;
- `✓ built`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useGlobalErrorHandler.ts src/composables/useGlobalErrorHandler.test.ts src/main.ts
git commit -m "feat(errors): a generic toast for any unhandled error or rejection, logged in DEV only

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/composables/useGlobalErrorHandler.ts", "src/composables/useGlobalErrorHandler.test.ts", "src/main.ts"], "verifyCommand": "npx vitest run src/composables/useGlobalErrorHandler.test.ts", "acceptanceCriteria": ["errorHandler + unhandledrejection, uninstall", "generic toast through useNotify, one per 5 s burst", "logged through logError in DEV only, non-errors never printed", "preventDefault on rejections", "installed in main.ts before mount", "410 tests"], "requiresUserVerification": false}
```

---

### Task 5: Shared constants; no test-only exports, misleading id or dead code (CC-04, CC-07, carry-overs)

**Goal:** `src/config/constants.ts` holds the data shared across files:
- the languages, listed once (TootCard and ControlsBar had their own copies);
- the default limits: image types, image size and images per toot, joining `DEFAULT_MAX_CHARACTERS`.

The OAuth scopes have been there since Lot 2. The exports kept only for tests are removed:
- `DEFAULT_IMAGE_LIMITS`;
- the store's `setLoading`;
- the instance store's `load`.

Also cleaned up:
- the misleading `id="schedule-button"` on the text area wrapper;
- the media toggle handler;
- the `'Alt' : 'Alt'` ternary.

**Files:**
- Modify: `src/config/constants.ts`
- Modify: `src/utils/media.ts`, `src/utils/media.test.ts`
- Modify: `src/stores/instance.ts`, `src/stores/instance.test.ts`
- Modify: `src/stores/scheduledToots.ts`, `src/components/Toot/ScheduledToots.test.ts`
- Modify: `src/components/ContentArea.vue`, `src/components/ContentArea.test.ts`
- Modify: `src/components/ControlsBar.vue`, `src/components/ControlsBar.test.ts`
- Modify: `src/components/Toot/TootCard.vue`, `src/components/Toot/TootCard.test.ts`
- Modify: `src/components/Toot/TootComposer.vue`, `src/components/MediaUpload.vue`

**Acceptance Criteria:**
- [ ] `constants.ts` exports:
  - `LANGUAGES`, the 14 `{ code, name }` pairs, in the existing order;
  - `SUPPORTED_IMAGE_TYPES`;
  - `DEFAULT_MAX_IMAGE_BYTES` (8 MB), formerly `MAX_IMAGE_BYTES`;
  - `DEFAULT_MAX_MEDIA_ATTACHMENTS` (4), formerly `MAX_IMAGES_PER_TOOT`.

  ControlsBar's options and TootCard's language names both come from `LANGUAGES`, and TootCard shows a code it doesn't list (set by another client) as is
- [ ] `media.ts` no longer defines or exports the defaults, nor `DEFAULT_IMAGE_LIMITS`; its test builds its own default limits
- [ ] The scheduled-toots store has no `setLoading` (it sets `isLoading` itself), and the instance store does not return `load`, which runs only from its watcher
- [ ] ContentArea's wrapper has no `id`
- [ ] TootComposer toggles the media section inline (`showMedia = !showMedia`). The poll toggle, renamed `togglePoll`, still empties the poll on close
- [ ] MediaUpload's button simply reads `Alt`
- [ ] `grep -rn "DEFAULT_IMAGE_LIMITS\|setLoading\|schedule-button\|MAX_IMAGES_PER_TOOT\|\bMAX_IMAGE_BYTES\|handleShowMedia" src` lists only `media.test.ts`'s own local `DEFAULT_IMAGE_LIMITS`
- [ ] typecheck, lint (0 errors) and build pass; `npm test` passes with 420 tests

**Verify:** `npx vitest run src/components/Toot/TootCard.test.ts src/components/ControlsBar.test.ts src/components/ContentArea.test.ts src/utils/media.test.ts src/stores/instance.test.ts src/components/Toot/ScheduledToots.test.ts` → `Tests  78 passed (78)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. In `src/components/ControlsBar.test.ts`, after `import { getTimeZone } from '../utils/timeZone';`, add:

```ts
import { LANGUAGES } from '../config/constants';
```

and add this test at the end of the `describe('ControlsBar', ...)` block:

```ts
  it('offers the languages of the shared list, by their own names', () => {
    const options = mount(ControlsBar, { props: baseProps }).findAll('#language option');

    expect(options.map(option => option.attributes('value'))).toEqual(LANGUAGES.map(language => language.code));
    expect(options.map(option => option.text())).toEqual(LANGUAGES.map(language => language.name));
  });
```

2. In `src/components/ContentArea.test.ts`, add at the end of the `describe('ContentArea', ...)` block:

```ts
  it('carries no id: the text area is not the schedule button', () => {
    expect(mountArea().find('.content-area').attributes('id')).toBeUndefined();
  });
```

3. In `src/components/Toot/TootCard.test.ts`, add at the end of the `describe('TootCard', ...)` block:

```ts
  it('names the language from the shared list, and shows a language it does not list by its code', () => {
    expect(mountCard({ language: 'fr' }).find('.toot-footer').text()).toContain('toot in Français');
    expect(mountCard({ language: 'eo' }).find('.toot-footer').text()).toContain('toot in eo');
    expect(mountCard().find('.toot-footer').text()).toContain('toot in Unknown');
  });
```

Run: `npx vitest run src/components/ControlsBar.test.ts src/components/ContentArea.test.ts src/components/Toot/TootCard.test.ts`

Expected: 2 failed:
- the ControlsBar test fails, because `LANGUAGES` does not exist yet;
- the ContentArea test fails, because the id is `schedule-button`.

The TootCard test already passes: it pins the behaviour the refactor must keep.

- [ ] **Step 2: Add the constants**

Append to `src/config/constants.ts`:

```ts

/** Image types Mastodon accepts that this app lets users attach (used when the instance gives no list). */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Mastodon's default image size limit, in bytes, used when the instance gives none. */
export const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon's default number of media attachments per toot, used when the instance gives none. */
export const DEFAULT_MAX_MEDIA_ATTACHMENTS = 4;

/** Languages a toot can be written in: ISO 639-1 code and the language's own name (composer and cards). */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
] as const;
```

- [ ] **Step 3: `media.ts` uses them; its test builds its own defaults**

1. In `src/utils/media.ts`, replace the top of the file, from `/** Image types Mastodon accepts…` down to and including `/** What an image is checked against before upload: the instance's limits, or the defaults above. */`, which is these lines:

```ts
/** Image types Mastodon accepts that this app lets users attach (used when the instance gives no list). */
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/** Default Mastodon image size limit, used when the instance gives none. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Mastodon's default number of media attachments per toot, used when the instance gives none. */
export const MAX_IMAGES_PER_TOOT = 4;

/** What an image is checked against before upload: the instance's limits, or the defaults above. */
```

with:

```ts
import { SUPPORTED_IMAGE_TYPES } from '../config/constants';

/** What an image is checked against before upload: the instance's limits, or the defaults (config/constants). */
```

Then delete these lines, which follow the `ImageLimits` interface:

```ts

/** The limits used until the instance gives its own. */
export const DEFAULT_IMAGE_LIMITS: ImageLimits = { imageTypes: SUPPORTED_IMAGE_TYPES, maxImageBytes: MAX_IMAGE_BYTES };
```

2. In `src/utils/media.test.ts`, replace the import block:

```ts
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
```

with:

```ts
import {
  acceptedImageFiles,
  describeImageTypes,
  formatMegabytes,
  getImageRejection,
  type ImageLimits,
  usableImageTypes,
} from './media';
import { DEFAULT_MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from '../config/constants';

/** The limits that apply until the instance gives its own. */
const DEFAULT_IMAGE_LIMITS: ImageLimits = { imageTypes: SUPPORTED_IMAGE_TYPES, maxImageBytes: DEFAULT_MAX_IMAGE_BYTES };
```

Then rename the remaining `MAX_IMAGE_BYTES` uses in that file:

```bash
perl -pi -e 's/(?<!DEFAULT_)\bMAX_IMAGE_BYTES\b/DEFAULT_MAX_IMAGE_BYTES/g' src/utils/media.test.ts
grep -c "DEFAULT_MAX_IMAGE_BYTES" src/utils/media.test.ts
```

Expected: `6` lines:
- the import and the local constant;
- `DEFAULT_MAX_IMAGE_BYTES + 1`;
- the 8 MB boundary test;
- the two HEIC/HEIF limits.

Use `perl`, not `sed`: BSD `sed` on macOS does not know `\b`.

- [ ] **Step 4: The instance store uses the constants and keeps `load` internal**

1. In `src/stores/instance.ts`, replace:

```ts
import { DEFAULT_MAX_CHARACTERS } from '../config/constants';
import { logError } from '../utils/logError';
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_TOOT, SUPPORTED_IMAGE_TYPES, usableImageTypes } from '../utils/media';
```

with:

```ts
import {
  DEFAULT_MAX_CHARACTERS,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_MAX_MEDIA_ATTACHMENTS,
  SUPPORTED_IMAGE_TYPES,
} from '../config/constants';
import { logError } from '../utils/logError';
import { usableImageTypes } from '../utils/media';
```

Replace each `MAX_IMAGES_PER_TOOT` with `DEFAULT_MAX_MEDIA_ATTACHMENTS` and each `MAX_IMAGE_BYTES` with `DEFAULT_MAX_IMAGE_BYTES` (3 of each: the `ref`s, `reset()` and `load()`). Then, in the returned object, delete:

```ts
    /** Reads the limits again for the current session. */
    load,
```

2. In `src/stores/instance.test.ts`, replace `import { SUPPORTED_IMAGE_TYPES } from '../utils/media';` with:

```ts
import { SUPPORTED_IMAGE_TYPES } from '../config/constants';
```

- [ ] **Step 5: No `setLoading`**

1. In `src/stores/scheduledToots.ts`:
   - delete the function:

```ts
  function setLoading(value: boolean): void {
    isLoading.value = value;
  }

```

   - in `fetchScheduledToots`, replace `      setLoading(true);` with `      isLoading.value = true;`, and `      if (seq === fetchSeq) setLoading(false);` with `      if (seq === fetchSeq) isLoading.value = false;`;
   - in the returned object, delete the line `    setLoading,`.
2. In `src/components/Toot/ScheduledToots.test.ts`, replace `      store.setLoading(true);` with:

```ts
      store.isLoading = true;
```

- [ ] **Step 6: Components**

1. `src/components/ContentArea.vue`: replace

```vue
  <div
    id="schedule-button"
    class="content-area"
  >
```

with:

```vue
  <div class="content-area">
```

(No style or script uses `#schedule-button`; check with `grep -rn "schedule-button" src`.)

2. `src/components/ControlsBar.vue`:
   - after `import { getTimeZone } from '../utils/timeZone';`, add `import { LANGUAGES } from '../config/constants';`;
   - delete the whole local `const languages = [ … ] as const;` block (14 entries) at the end of `<script setup>`;
   - in the template, replace `v-for="lang in languages"` with `v-for="lang in LANGUAGES"`.
3. `src/components/Toot/TootCard.vue`:
   - after `import { getTimeZone } from '../../utils/timeZone';`, add `import { LANGUAGES } from '../../config/constants';`;
   - delete the local `const languages = { en: 'English', … } as const;` block and the blank line after it;
   - in `getLanguageName`, replace

```ts
  if (!code) return 'Unknown';
  return languages[code as keyof typeof languages] || code;
```

with:

```ts
  if (!code) return 'Unknown';
  // A language this app doesn't list (set by another client) is shown by its code.
  return LANGUAGES.find(language => language.code === code)?.name ?? code;
```

4. `src/components/Toot/TootComposer.vue`: replace

```ts
function handleShowMedia() {
  showMedia.value = !showMedia.value;
}

function handleShowPoll() {
  showPoll.value = !showPoll.value;
```

with:

```ts
function togglePoll() {
  showPoll.value = !showPoll.value;
```

and in the template replace

```vue
        @add-media="handleShowMedia"
        @add-poll="handleShowPoll"
```

with:

```vue
        @add-media="showMedia = !showMedia"
        @add-poll="togglePoll"
```

5. `src/components/MediaUpload.vue`: replace `              {{ editingMediaIndex === index ? 'Alt' : 'Alt' }}` with:

```vue
              Alt
```

- [ ] **Step 7: Run the checks**

```bash
npx vitest run src/components/Toot/TootCard.test.ts src/components/ControlsBar.test.ts src/components/ContentArea.test.ts src/utils/media.test.ts src/stores/instance.test.ts src/components/Toot/ScheduledToots.test.ts
grep -rn "DEFAULT_IMAGE_LIMITS\|setLoading\|schedule-button\|MAX_IMAGES_PER_TOOT\|\bMAX_IMAGE_BYTES\|handleShowMedia\|'Alt' : 'Alt'" src | grep -v "src/utils/media.test.ts"
npm run typecheck && npm run lint && npm test
npm run build
```

Expected:
- `Tests  78 passed (78)`;
- the grep prints nothing;
- typecheck exits 0;
- `0 errors, 2 warnings`;
- `Tests  420 passed (420)`;
- `✓ built`.

- [ ] **Step 8: Commit**

```bash
git add src/config/constants.ts src/utils/media.ts src/utils/media.test.ts src/stores/instance.ts src/stores/instance.test.ts src/stores/scheduledToots.ts src/components/Toot/ScheduledToots.test.ts src/components/ContentArea.vue src/components/ContentArea.test.ts src/components/ControlsBar.vue src/components/ControlsBar.test.ts src/components/Toot/TootCard.vue src/components/Toot/TootCard.test.ts src/components/Toot/TootComposer.vue src/components/MediaUpload.vue
git commit -m "refactor: shared languages and default limits in constants; no test-only exports or dead code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/config/constants.ts", "src/utils/media.ts", "src/utils/media.test.ts", "src/stores/instance.ts", "src/stores/instance.test.ts", "src/stores/scheduledToots.ts", "src/components/Toot/ScheduledToots.test.ts", "src/components/ContentArea.vue", "src/components/ContentArea.test.ts", "src/components/ControlsBar.vue", "src/components/ControlsBar.test.ts", "src/components/Toot/TootCard.vue", "src/components/Toot/TootCard.test.ts", "src/components/Toot/TootComposer.vue", "src/components/MediaUpload.vue"], "verifyCommand": "npx vitest run src/components/Toot/TootCard.test.ts src/components/ControlsBar.test.ts src/components/ContentArea.test.ts src/utils/media.test.ts src/stores/instance.test.ts src/components/Toot/ScheduledToots.test.ts", "acceptanceCriteria": ["LANGUAGES and default limits in constants, used by ControlsBar, TootCard, media and the instance store", "no DEFAULT_IMAGE_LIMITS, setLoading or instance.load export", "no schedule-button id", "inline media toggle, togglePoll, plain Alt label", "413 tests"], "requiresUserVerification": false}
```

---

### Task 6: Features store hardening, JSDoc where things are defined, no unused dependency (CC-09, CC-07, CC-06, CC-08)

**Goal:**
- A corrupt or foreign value under `masto-publish-later-features` no longer crashes the app at startup; it counts as "nothing seen yet".
- A storage refusal no longer breaks the What's New button.
- `lastThreeNewFeatures` becomes `recentNewFeatures`, and the unused, wrong `APP_VERSION` goes.
- JSDoc lives where each item is defined, not a second time in the returned objects.
- `@vueuse/components` and `@vueuse/core`, never imported, are uninstalled.
- The two skills that named the old symbols are updated.

**Files:**
- Create: `src/stores/features.test.ts`
- Modify: `src/stores/features.ts` (head and tail; the changelog array is untouched)
- Modify: `src/types/features.ts` (`APP_VERSION` removed)
- Modify: `src/composables/useMastodonApi.ts` (returned object)
- Modify: `src/stores/instance.ts` (JSDoc moved to the refs)
- Modify: `package.json`, `package-lock.json` (`npm uninstall`)
- Modify: `.claude/skills/changelog/SKILL.md`, `.claude/skills/vue3-codegen/SKILL.md`

**Acceptance Criteria:**
- [ ] The saved state is parsed inside `try`/`catch` and validated with zod (`lastSeenVersion: string`, `seenFeatures: string[]`, each field falling back on its own). Invalid JSON, a non-object, a wrong type or `null` gives the empty state
- [ ] Writing the state is wrapped in `try`/`catch` (logged with `logError`): `markFeaturesAsSeen()` never throws
- [ ] The store still exposes `features`, `newFeatures` (now `recentNewFeatures`, at most 3 unseen releases, newest first) and `markFeaturesAsSeen`. `App.vue` and `WhatsNew.vue` are unchanged
- [ ] `APP_VERSION` is gone, and `latestVersion` no longer falls back to a made-up `'1.0.0'`
- [ ] A test pins the changelog's invariants: `features[0].version === package.json` version, and every `Feature.id` and version is unique
- [ ] The objects returned by `useMastodonApi`, the features store and the instance store list their members without repeating the JSDoc; that JSDoc now sits on the definitions. `useNotify` keeps its inline docs, which are the definitions
- [ ] `@vueuse/components` and `@vueuse/core` are gone from `package.json` and the lock file; `npx depcheck` prints `No depcheck issue`
- [ ] `.claude/skills/changelog/SKILL.md` no longer mentions `APP_VERSION` or `lastThreeNewFeatures`. `.claude/skills/vue3-codegen/SKILL.md` asks for JSDoc at the definition, not in the returned object
- [ ] typecheck, lint (0 errors) and build pass; `npm test` passes with 430 tests

**Verify:** `npx vitest run src/stores/features.test.ts` → `Tests  10 passed (10)`

**Steps:**

- [ ] **Step 1: Write the failing test**

Create `src/stores/features.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFeaturesStore } from './features';
import packageJson from '../../package.json';

const STORAGE_KEY = 'masto-publish-later-features';

/** Versions, newest first, as listed by the store. */
const versionsOf = (groups: { version: string }[]) => groups.map(group => group.version);

describe('features store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows at most the three most recent releases, newest first, to a new user', () => {
    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(0, 3)));
  });

  it('leaves out the releases already seen', () => {
    const latest = useFeaturesStore().features[0].version;
    setActivePinia(createPinia());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastSeenVersion: latest, seenFeatures: [latest] }));

    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(1, 4)));
  });

  it.each([
    ['not JSON', '{not json'],
    ['not an object', '"0.16.0"'],
    ['a list of the wrong type', '{"lastSeenVersion":"0.16.0","seenFeatures":"0.16.0"}'],
    ['null', 'null'],
  ])('starts afresh when the saved state is %s, instead of breaking the app', (_label, saved) => {
    localStorage.setItem(STORAGE_KEY, saved);

    const store = useFeaturesStore();

    expect(versionsOf(store.newFeatures)).toEqual(versionsOf(store.features.slice(0, 3)));
  });

  it('marks every release as seen, and remembers it', () => {
    const store = useFeaturesStore();

    store.markFeaturesAsSeen();

    expect(store.newFeatures).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      lastSeenVersion: store.features[0].version,
      seenFeatures: versionsOf(store.features),
    });
  });

  it('still closes What\'s New when the browser refuses to save', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const store = useFeaturesStore();

    expect(() => store.markFeaturesAsSeen()).not.toThrow();
    expect(store.newFeatures).toEqual([]);
  });

  it('keeps the changelog consistent: the newest release is the package version, ids and versions are unique', () => {
    const { features } = useFeaturesStore();
    const ids = features.flatMap(group => group.features.map(feature => feature.id));

    expect(features[0].version).toBe(packageJson.version);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(versionsOf(features)).size).toBe(features.length);
  });
});
```

The spy is on `localStorage` itself: `Storage.prototype` does not reach happy-dom's `localStorage`. `package.json` is imported through `resolveJsonModule` (`@vue/tsconfig`); the dry run's typecheck accepted it.

Run: `npx vitest run src/stores/features.test.ts`

Expected: `Tests  5 failed | 4 passed (9)`:
- the four corrupt states fail, with a `SyntaxError` or a `TypeError … reading 'includes'` / `'seenFeatures'`, or the wrong list;
- "refuses to save" fails with `QuotaExceededError`.

- [ ] **Step 2: Harden the store**

1. In `src/stores/features.ts`, replace the head of the file, from the first line down to and including the JSDoc above `export const useFeaturesStore`:

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FeatureGroup, UserFeatureState } from '../types/features';

const STORAGE_KEY = 'masto-publish-later-features';

/**
 * Creates a Pinia store for managing app features.
 * @returns {Object} The features store with state and actions.
 */
```

with:

```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { z } from 'zod';
import type { FeatureGroup, UserFeatureState } from '../types/features';
import { logError } from '../utils/logError';

const STORAGE_KEY = 'masto-publish-later-features';

/** What's New shows at most this many unseen releases, newest first. */
const MAX_RECENT_RELEASES = 3;

/** The saved state; a wrong field falls back to its empty value. */
const UserFeatureStateSchema = z.object({
  lastSeenVersion: z.string().catch(''),
  seenFeatures: z.array(z.string()).catch([]),
});

/**
 * Reads what the user has already seen. A missing, corrupt or foreign value gives a fresh
 * state: a bad value in localStorage must never break the app at startup.
 * @returns {UserFeatureState} The saved state, or an empty one.
 */
function readSavedState(): UserFeatureState {
  const empty: UserFeatureState = { lastSeenVersion: '', seenFeatures: [] };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return empty;
    const parsed = UserFeatureStateSchema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : empty;
  } catch {
    return empty;
  }
}

/**
 * Creates a Pinia store for the "What's New" release notes and what the user has seen of them.
 * @returns {Object} `features`, `newFeatures` and `markFeaturesAsSeen`.
 */
```

2. Right below `export const useFeaturesStore = defineStore('features', () => {`, replace `  const features = ref<FeatureGroup[]>([` with:

```ts
  /** Every release, newest first: the changelog (append-only, see the changelog skill). */
  const features = ref<FeatureGroup[]>([
```

3. Replace everything after the changelog array, from `  // Get the latest version from features` to the end of the file, with:

```ts
  /** The newest release; written as the last version seen. */
  const latestVersion = computed(() => features.value[0]?.version ?? '');

  /** What the user has already seen, read once at startup. */
  const userState = ref<UserFeatureState>(readSavedState());

  /** Remembers what was seen. The browser may refuse (storage full or disabled): What's New still closes. */
  function saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState.value));
    } catch (error) {
      logError('Could not save the seen releases', error);
    }
  }

  /** Releases the user has not seen yet, newest first. */
  const unseenFeatures = computed(() =>
    features.value.filter(group => !userState.value.seenFeatures.includes(group.version)),
  );

  /** The few most recent unseen releases: what the What's New dialog shows. */
  const recentNewFeatures = computed(() => unseenFeatures.value.slice(0, MAX_RECENT_RELEASES));

  /** Marks every release as seen, and saves it. */
  function markFeaturesAsSeen(): void {
    userState.value.seenFeatures = features.value.map(group => group.version);
    userState.value.lastSeenVersion = latestVersion.value;
    saveState();
  }

  return {
    features,
    newFeatures: recentNewFeatures,
    markFeaturesAsSeen,
  };
});
```

4. In `src/types/features.ts`, delete the last line, `export const APP_VERSION = '1.0.0'; `, and the blank line before it. The file ends with the `UserFeatureState` interface. Check that `grep -rn "APP_VERSION\|lastThreeNewFeatures" src` prints nothing.

- [ ] **Step 3: JSDoc at the definition, not again in the returned object**

1. In `src/composables/useMastodonApi.ts`, each function already has its JSDoc. Replace the whole returned object (from `  return {` to its closing `  };`) with:

```ts
  return {
    registerApplication,
    getAccessToken,
    verifyCredentials,
    getInstanceConfiguration,
    scheduleToot,
    rescheduleToot,
    scheduledTootExists,
    sendThanks,
    uploadMedia,
    updateMediaMetadata,
    getScheduledToots,
    deleteScheduledToot,
  };
```

2. In `src/stores/instance.ts`, replace:

```ts
  const maxCharacters = ref(DEFAULT_MAX_CHARACTERS);
  const maxMediaAttachments = ref(DEFAULT_MAX_MEDIA_ATTACHMENTS);
  const imageSizeLimit = ref(DEFAULT_MAX_IMAGE_BYTES);
  const supportedMimeTypes = ref<string[]>([...SUPPORTED_IMAGE_TYPES]);
```

with:

```ts
  /** Longest toot the instance accepts, in characters. */
  const maxCharacters = ref(DEFAULT_MAX_CHARACTERS);
  /** Most images per toot. */
  const maxMediaAttachments = ref(DEFAULT_MAX_MEDIA_ATTACHMENTS);
  /** Largest image, in bytes. */
  const imageSizeLimit = ref(DEFAULT_MAX_IMAGE_BYTES);
  /** Image MIME types the app can attach on this instance (images only, never empty). */
  const supportedMimeTypes = ref<string[]>([...SUPPORTED_IMAGE_TYPES]);
```

and replace its returned object with:

```ts
  return {
    maxCharacters,
    maxMediaAttachments,
    imageSizeLimit,
    supportedMimeTypes,
    hasCharacterLimit,
    hasMediaLimit,
  };
```

`hasCharacterLimit` and `hasMediaLimit` are already documented where they are defined.

3. Check: `grep -rn "^    /\*\*" src/stores src/composables --include='*.ts' | grep -v test` lists only `src/composables/useNotify.ts`, whose inline arrow functions are the definitions.

- [ ] **Step 4: Remove the unused dependencies**

```bash
grep -rn "@vueuse" src index.html vite.config.ts   # expected: nothing
npm uninstall @vueuse/components @vueuse/core
npx -y depcheck
```

Expected: `npm uninstall` ends with `found 0 vulnerabilities`, and depcheck prints `No depcheck issue`. Before this step it listed both packages as unused dependencies. If npm crashes with `reading 'edgesOut'`, use `npx -y npm@11 uninstall @vueuse/components @vueuse/core` (CLAUDE.md); the dry run's npm 10.9.4 did not crash.

- [ ] **Step 5: Keep the skills in step**

1. In `.claude/skills/changelog/SKILL.md`, replace:

```markdown
> ⚠️ The `APP_VERSION` constant in `src/types/features.ts` is currently unused.
> The authoritative version comes from `features[0].version` in the store.
> Always keep `package.json` and the store's first entry in sync.
```

with:

```markdown
> The authoritative version comes from `features[0].version` in the store.
> Always keep `package.json` and the store's first entry in sync: `src/stores/features.test.ts`
> fails when they differ, or when a `Feature.id` or a version is used twice.
```

and replace:

```markdown
The store exposes `lastThreeNewFeatures` — the first 3 `FeatureGroup` entries whose
`version` string is NOT in the user's `seenFeatures` localStorage array.
```

with:

```markdown
The store exposes `newFeatures` (`recentNewFeatures` inside the store) — the first 3 `FeatureGroup`
entries whose `version` string is NOT in the user's `seenFeatures` localStorage array. A missing or
corrupt saved value counts as "nothing seen yet".
```

2. In `.claude/skills/vue3-codegen/SKILL.md`, under "Pinia stores", replace `- Add JSDoc comments to all state properties and actions in the returned object` with:

```markdown
- Add a JSDoc comment to each state property and action where it is defined; the returned object only lists them (no second copy of the docs)
```

- [ ] **Step 6: Run the checks**

```bash
npx vitest run src/stores/features.test.ts
npm run typecheck && npm run lint && npm test
npm run build
```

Expected:
- `Tests  10 passed (10)`;
- typecheck exits 0;
- `0 errors, 2 warnings`;
- `Tests  430 passed (430)`;
- `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/stores/features.ts src/stores/features.test.ts src/types/features.ts src/composables/useMastodonApi.ts src/stores/instance.ts package.json package-lock.json .claude/skills/changelog/SKILL.md .claude/skills/vue3-codegen/SKILL.md
git commit -m "fix(features): survive a corrupt saved state; recentNewFeatures; drop APP_VERSION, duplicated JSDoc and @vueuse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/stores/features.ts", "src/stores/features.test.ts", "src/types/features.ts", "src/composables/useMastodonApi.ts", "src/stores/instance.ts", "package.json", "package-lock.json", ".claude/skills/changelog/SKILL.md", ".claude/skills/vue3-codegen/SKILL.md"], "verifyCommand": "npx vitest run src/stores/features.test.ts", "acceptanceCriteria": ["saved state parsed in try/catch with zod, corrupt values give a fresh state", "saving never throws", "recentNewFeatures exposed as newFeatures; no APP_VERSION", "changelog invariants tested against package.json", "no duplicated JSDoc in returned objects", "@vueuse removed, depcheck clean", "skills updated", "422 tests"], "requiresUserVerification": false}
```

---

### Task 7: Scheduled toots: one list request per visit; `MastodonStatus` matches what zod validates (carry-overs)

**Goal:**
- **One request.** The composer page asks for the scheduled list once. Today TootComposer and its child ScheduledToots both call `fetchScheduledToots()` on mount, and Lot 4's `fetchSeq` only kept the second answer. The list component keeps its own load, so the list owns its data; the composer stops loading it.
- **One honest type.** Lot 3's schema lets `params.visibility`, `media_ids` and `poll` be null, and other clients' toots can carry null `language`, `sensitive` or `spoiler_text`. `MastodonStatus` becomes the shape the app actually holds:
  - required `params`, with nullable fields;
  - typed media;
  - none of the fields a scheduled status lacks (`content`, `created_at`, `url`, top-level `visibility`).

**Feasibility, measured in the dry run:** aligning the type raised 11 typecheck errors, all small:
- three TootCard props that did not accept `null`;
- the media prop type;
- four test fixtures with fields a scheduled status lacks;
- two `isOnlyScheduleChange` test cases.

So it is done here rather than left as a residual. The `as unknown as MastodonStatus[]` cast in `getScheduledToots` becomes a plain `as MastodonStatus[]`. A cast stays because the schema passes some params through unchecked.

**Files:**
- Modify: `src/types/mastodon.ts`
- Modify: `src/composables/useMastodonApi.ts` (the cast and its comment)
- Modify: `src/components/Toot/TootCard.vue`, `src/components/Toot/TootCard.test.ts`
- Modify: `src/components/Toot/ScheduledToots.vue`, `src/components/Toot/ScheduledToots.test.ts`
- Modify: `src/components/Toot/TootComposer.vue`, `src/components/Toot/TootComposer.test.ts`
- Modify: `src/stores/scheduledToots.test.ts`, `src/utils/isOnlyScheduleChange.test.ts`

**Acceptance Criteria:**
- [ ] Opening the composer sends exactly one `GET /api/v1/scheduled_statuses` (with its pages, if any). Only `ScheduledToots`' `onMounted` loads it; TootComposer still fetches the account when it is missing
- [ ] `ScheduledStatusParams` is exported, and `MastodonStatus` is:

  ```ts
  { id: string; scheduled_at: string; params: ScheduledStatusParams; media_attachments: MastodonMediaAttachment[] }
  ```

  The params are `text: string` and, all optional and nullable: `visibility`, `media_ids`, `sensitive`, `spoiler_text`, `language` and `poll`. No `any` is left in `types/mastodon.ts`
- [ ] `TootCard`:
  - accepts `null` for `visibility`, `language`, `sensitive`, `spoilerText` and `poll`, and shows such a toot as "Public toot in Unknown" with no warning toggle;
  - takes `medias` as `MastodonMediaAttachment[]`;
  - its `spoiler_text` prop is renamed `spoilerText` (`vue/prop-name-casing`)
- [ ] `npm run lint` reports **0 problems** (the last two warnings are gone)
- [ ] typecheck and build pass; `npm test` passes with 438 tests

**Verify:** `npx vitest run src/components/Toot src/utils/isOnlyScheduleChange.test.ts src/stores/scheduledToots.test.ts` → `Tests  119 passed (119)`

**Steps:**

- [ ] **Step 1: Write the failing tests**

1. In `src/components/Toot/TootComposer.test.ts`, add before `it('sends a single request when the form is submitted twice quickly', ...)`:

```ts
  it('loads the scheduled list once when it opens', async () => {
    mountComposer();
    await flushPromises();

    expect(api.getScheduledToots).toHaveBeenCalledTimes(1);
  });

```

2. In `src/components/Toot/TootCard.test.ts`, add before `it('names the language from the shared list, …', ...)` (added in Task 5):

```ts
  it('shows a toot whose params came back null as a plain public toot', () => {
    const card = mountCard({ visibility: null, language: null, sensitive: null, spoilerText: null, poll: null });

    expect(card.find('.sensitive-warning').exists()).toBe(false);
    expect(card.find('.toot-footer').text()).toBe('Public toot in Unknown');
  });

```

Run: `npx vitest run src/components/Toot/TootComposer.test.ts src/components/Toot/TootCard.test.ts`

Expected: `Tests  1 failed | 37 passed (38)`. The composer test fails with `expected "vi.fn()" to be called 1 times, but got 2 times`. The TootCard test passes at runtime already: it pins the null handling that the typed props must keep.

- [ ] **Step 2: Align the type**

In `src/types/mastodon.ts`, replace the whole `export interface MastodonStatus { … }` block (from `export interface MastodonStatus {` to its closing `}`, which ends after `status?: string;`) with:

```ts
/**
 * The params of a scheduled status, echoed by Mastodon as the client sent them: any of them may be
 * null or missing. ScheduledStatusSchema checks text, visibility, media ids and poll options.
 */
export interface ScheduledStatusParams {
  text: string;
  visibility?: string | null;
  media_ids?: string[] | null;
  sensitive?: boolean | null;
  spoiler_text?: string | null;
  language?: string | null;
  poll?: PollParams | null;
}

/** A scheduled status (GET /api/v1/scheduled_statuses), as validated by ScheduledStatusSchema. */
export interface MastodonStatus {
  id: string;
  scheduled_at: string;
  params: ScheduledStatusParams;
  media_attachments: MastodonMediaAttachment[];
}
```

`MastodonMediaAttachment` is declared further down the same file; interfaces are hoisted.

In `src/composables/useMastodonApi.ts`, replace:

```ts
        // Validated shape; MastodonStatus is the app's (looser) view of a scheduled status.
        toots.push(...(page as unknown as MastodonStatus[]));
```

with:

```ts
        // The schema checks what the app renders or compares; the params it passes through
        // (sensitive, spoiler_text, language, the poll's duration and flags) are typed as Mastodon documents them.
        toots.push(...(page as MastodonStatus[]));
```

- [ ] **Step 3: The card accepts what the type allows**

1. In `src/components/Toot/TootCard.vue`:
   - replace `import type { PollParams } from '../../types/mastodon';` with `import type { MastodonMediaAttachment, PollParams } from '../../types/mastodon';`;
   - replace the start of the props interface:

```ts
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
```

with:

```ts
/** Params of a scheduled status may come back null (see ScheduledStatusParams). */
interface Props {
  id: string;
  scheduledAt: string;
  text?: string;
  visibility?: string | null;
  language?: string | null;
  sensitive?: boolean | null;
  medias?: MastodonMediaAttachment[];
  poll?: PollParams | null;
  spoilerText?: string | null;
```

   - replace `function getCapitalizedVisibility(visibility: string | undefined): string {` with `function getCapitalizedVisibility(visibility: string | null | undefined): string {`;
   - replace `function getLanguageName(code: string | undefined): string {` with `function getLanguageName(code: string | null | undefined): string {`;
   - in the template, replace `{{ props.spoiler_text }}</label>` with `{{ props.spoilerText }}</label>`.
2. In `src/components/Toot/ScheduledToots.vue`, in the `<TootCard>` bindings:
   - replace `:spoiler_text="toot.params?.spoiler_text"` with `:spoiler-text="toot.params?.spoiler_text"`;
   - replace `:scheduled-at="toot.scheduled_at || ''"` with `:scheduled-at="toot.scheduled_at"`, since it is now required.
3. In `src/components/Toot/TootCard.test.ts`, replace the three `spoiler_text:` props with `spoilerText:`:
   - `spoiler_text: 'Spoiler A'` and `spoiler_text: 'Spoiler B'` in the two-cards test;
   - `mountCard({ sensitive: true, spoiler_text: 'Spoiler' })` in "names the toggle after what it does".

- [ ] **Step 4: The composer stops loading the list**

In `src/components/Toot/TootComposer.vue`:

1. At the end of `onMounted`, replace:

```ts
  await store.fetchScheduledToots();
});
```

with:

```ts
  // The scheduled list loads itself (ScheduledToots): one request per visit.
});
```

`handleSubmit`'s reload after a failure, and the store's own reloads, are unchanged.

2. In the `store.editingToot` watcher, `media_attachments` is no longer optional. Replace:

```ts
  mediaAttachments.value = newToot.media_attachments || [];

  // Show media section if there are media attachments
  showMedia.value = newToot.media_attachments?.length > 0;
```

with:

```ts
  mediaAttachments.value = newToot.media_attachments;

  // Show media section if there are media attachments
  showMedia.value = newToot.media_attachments.length > 0;
```

- [ ] **Step 5: Test fixtures without the fields a scheduled status lacks**

1. In `src/utils/isOnlyScheduleChange.test.ts`, `src/components/Toot/TootComposer.test.ts` and `src/components/Toot/ScheduledToots.test.ts`, delete these four lines from the fixture builder (`makeOriginal`, `makeScheduledToot`, `scheduledToot`):

```ts
    content: '',
    created_at: '',
    visibility: 'public',
    url: '',
```

2. In `src/stores/scheduledToots.test.ts`, delete the same four lines, indented by two spaces, from `const original: MastodonStatus = { … }`.
3. In `src/utils/isOnlyScheduleChange.test.ts`:
   - replace `import type { MastodonStatus, ScheduledToot } from '../types/mastodon';` with `import type { MastodonStatus, ScheduledStatusParams, ScheduledToot } from '../types/mastodon';`;
   - replace `function makeOriginal(params: Partial<NonNullable<MastodonStatus['params']>> = {}): MastodonStatus {` with `function makeOriginal(params: Partial<ScheduledStatusParams> = {}): MastodonStatus {`;
   - replace `media_attachments: [{ id: 'm1' }] };` with `media_attachments: [{ id: 'm1', type: 'image' as const, url: null }] };`;
   - replace

```ts
    expect(isOnlyScheduleChange({ ...makeOriginal(), params: undefined }, makeUpdated())).toBe(false);
```

with:

```ts
    // A status without params (the schema refuses one) is never taken for a date-only change.
    expect(isOnlyScheduleChange({ ...makeOriginal(), params: undefined } as unknown as MastodonStatus, makeUpdated())).toBe(false);
```

- [ ] **Step 6: Run the checks**

```bash
npx vitest run src/components/Toot src/utils/isOnlyScheduleChange.test.ts src/stores/scheduledToots.test.ts
npm run typecheck && npm run lint && npm test
npm run build
```

Expected:
- `Tests  119 passed (119)`;
- typecheck exits 0, with no error left from the 11 the type change raised;
- lint prints no problem at all;
- `Tests  438 passed (438)`;
- `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add src/types/mastodon.ts src/composables/useMastodonApi.ts src/components/Toot/TootCard.vue src/components/Toot/TootCard.test.ts src/components/Toot/ScheduledToots.vue src/components/Toot/ScheduledToots.test.ts src/components/Toot/TootComposer.vue src/components/Toot/TootComposer.test.ts src/stores/scheduledToots.test.ts src/utils/isOnlyScheduleChange.test.ts
git commit -m "fix(toots): one list request per visit; MastodonStatus matches what the schema validates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["src/types/mastodon.ts", "src/composables/useMastodonApi.ts", "src/components/Toot/TootCard.vue", "src/components/Toot/TootCard.test.ts", "src/components/Toot/ScheduledToots.vue", "src/components/Toot/ScheduledToots.test.ts", "src/components/Toot/TootComposer.vue", "src/components/Toot/TootComposer.test.ts", "src/stores/scheduledToots.test.ts", "src/utils/isOnlyScheduleChange.test.ts"], "verifyCommand": "npx vitest run src/components/Toot src/utils/isOnlyScheduleChange.test.ts src/stores/scheduledToots.test.ts", "acceptanceCriteria": ["one scheduled-list request when the composer opens", "MastodonStatus = validated shape with nullable params, typed media, no any", "TootCard accepts nulls, spoilerText prop", "lint 0 problems", "438 tests"], "requiresUserVerification": false}
```

---

### Task 8: Release 0.16.1

**Goal:** Version **0.16.1**, a PATCH. The changelog skill's rules make it one: this lot brings performance fixes, bug fixes and small improvements, and no new user-visible feature. "What's New" gets entries for the user-visible changes only:
- the lighter first load;
- readable notifications;
- the message shown on an unexpected error;
- the scroll lock behind dialogs;
- content warnings from other apps (the `sensitive` fix, ce71f77).

The README gets a features line and a security sentence.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/stores/features.ts` (a new group at index 0)
- Modify: `README.md`

**Acceptance Criteria:**
- [ ] The version is `0.16.1` in `package.json`, `package-lock.json` and the first FeatureGroup, dated `2026-10-08`
- [ ] The 5 new ids are unique. Each title starts with an emoji and is at most 60 characters; each description is plain text, at most 3 sentences
- [ ] No existing FeatureGroup is changed
- [ ] Nothing invisible gets an entry: not the meta tags, the logging, the constants, the types or the dependencies
- [ ] README: a "⚡ Lightweight" line under Features; the Security section's last item says how errors are logged in development
- [ ] lint (0 problems), typecheck, test (438, including the changelog-consistency test from Task 6) and build pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.16.1`

**Steps:**

- [ ] **Step 1:** Read `.claude/skills/changelog/SKILL.md`.
- [ ] **Step 2:** Run `npm version patch --no-git-tag-version`. Expected output: `v0.16.1`. `npm test` now fails one test, "keeps the changelog consistent…", until Step 4: the package version is ahead of the store.
- [ ] **Step 3:** Run `grep -nE "faster-first-load|readable-notifications|unexpected-error-message|dialog-scroll-lock|content-warning-from-other-apps" src/stores/features.ts`. Expected: no output.
- [ ] **Step 4:** Prepend this group at the top of the `features` array (before `version: '0.16.0'`):

```ts
    {
      version: '0.16.1',
      date: '2026-10-08',
      features: [
        {
          id: 'faster-first-load',
          title: '⚡ Faster First Load',
          description: 'Toot Scheduler now downloads about half a megabyte less on your first visit: its fonts are a tenth of their former size, and look the same. Your scheduled toots are also loaded once instead of twice when the composer opens.'
        },
        {
          id: 'readable-notifications',
          title: '💄 Easier-to-Read Notifications',
          description: 'Notifications now use the app\'s own high-contrast colours, so every message is easy to read.'
        },
        {
          id: 'unexpected-error-message',
          title: '🐛 Fix: No More Silent Failures',
          description: 'When something unexpected goes wrong, a message now tells you, and invites you to try again or reload the page, instead of nothing happening.'
        },
        {
          id: 'dialog-scroll-lock',
          title: '🐛 Fix: The Page Stays Put Behind Dialogs',
          description: 'Scrolling inside a dialog, such as this one, no longer scrolls the page behind it.'
        },
        {
          id: 'content-warning-from-other-apps',
          title: '🐛 Fix: Content Warnings From Other Apps',
          description: 'A toot scheduled from another app no longer shows a content warning it does not have.'
        },
      ],
    },
```

- [ ] **Step 5:** In `README.md`:
  - under `## Features`, replace `- 📱 Responsive design` with:

```markdown
- 📱 Responsive design
- ⚡ Lightweight: self-hosted fonts, subset to about 130 KB
```

  - in `## Security`, in the "Known trade-off" item, replace `and the production build contains no console output.` with:

```markdown
and the production build contains no console output. In development, errors are logged as short summaries (plus the stack of a plain error), never with the request's headers or token.
```

- [ ] **Step 6:** Run `npm run lint && npm run typecheck && npm test && npm run build`.

Expected:
- lint prints no problem;
- typecheck exits 0;
- `Tests  438 passed (438)`;
- `✓ built`.

The `spa-redirect.js` "can't be bundled" warning from Lot 3 is expected.
- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts README.md
git commit -m "chore(release): 0.16.1 — lighter fonts, readable toasts, error message, dialog scroll lock

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts", "README.md"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.16.1 everywhere (PATCH per the changelog rules)", "5 unique ids following the changelog rules, user-visible changes only", "append-only changelog", "README features and security updated", "lint, typecheck, test (438), build pass"], "requiresUserVerification": false}
```

---

### Task 9: Verification by the controller; report to the user

**Goal:** The controller, not a subagent:
- runs the quality gates;
- checks the font size in `dist` and the dependencies;
- extends its Playwright suite with the Lot 5 checks and runs it on the production build, in Chromium and WebKit, against the mocked instance.

It then reports, and asks the user for the one check only they can do: Lighthouse performance on the deployed site.

**Files:**
- None in the repo. The suite is in the session scratchpad, `e2e/e2e.mjs`, with Playwright and `axe-core` installed next to it (`e2e/node_modules`), not in the project

**Acceptance Criteria:**
- [ ] `npm test` (438), `npm run typecheck`, `npm run lint` (0 problems) and `npm run build` pass
- [ ] `dist/assets` holds exactly two `.woff2` files and no `.ttf`, under 300 KB together (127,568 bytes in the dry run; shipped: 129,704 bytes)
- [ ] `npx -y depcheck` prints `No depcheck issue`
- [ ] The Playwright suite passes:
  - Chromium **48/48**: the 41 existing checks and L5-1 to L5-7;
  - WebKit **49/49**: the 42 existing checks and L5-1 to L5-7.

  L3-8 (no CSP violation) and #10 (no console output) also cover the new flows
- [ ] The user has been told what the run proves, has run Lighthouse on the landing page (desktop and mobile), and has answered

**Verify:** `node e2e.mjs` and `BROWSER=webkit node e2e.mjs` → `48/48 passed` and `49/49 passed`

**Steps:**

- [ ] **Step 1: Quality gates, size and dependencies** (in the repo)

```bash
npm run lint && npm run typecheck && npm test && npm run build
ls dist/assets | grep -cE '\.ttf$'                                # expected: 0
ls -l dist/assets/*.woff2 | awk '{n++; s+=$5} END {print n, s}'   # expected: 2 and about 129704 (< 307200)
npx -y depcheck                                                   # expected: No depcheck issue
```

- [ ] **Step 2: Add the Lot 5 checks** (in the scratchpad `e2e/` folder, never in the repo)

`toast(page, text)`, `signIn`, `waitComposer`, `trackConsole`, `newContext`, `instance.calls(path)` and the `AXE` source already exist in the suite. The existing `axeScan` waits until no toast is shown, so L5-3 needs its own scan, run while the toasts are visible:

```js
async function axeScanWithToasts(page) {
  await page.evaluate(AXE);
  const { violations } = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  return violations;
}
```

| Id | Check | Pass when |
|---|---|---|
| L5-1 | Fonts. Record every response on a fresh landing page; wait for `document.fonts.ready` | Every font response ends in `.woff2` with status 200, and there is no `.ttf` request. `document.fonts` lists `Nunito Sans` and `Winky Sans` with `status === 'loaded'`. The font bytes add up to less than 300 KB. No response from `localhost:4173` is 4xx. The dry run's probe saw `200 WinkySans-Variable-Latin-*.woff2` and `200 NunitoSans-Variable-Latin-*.woff2` |
| L5-2 | Scroll lock. Open the login dialog ("Get started"), read `getComputedStyle(document.body).overflow`, press Escape, read it again. Then sign in and do the same with What's New | `hidden` while each dialog is open, `visible` after it closes. Before Lot 5 the production CSS had no `modal-open` rule, so this would have read `visible` |
| L5-3 | Toast contrast. Signed in, bring up toasts and scan while they are visible (`axeScanWithToasts`), at least for:<br>- a success toast: "Say Thanks" confirmed, with the mock answering 200;<br>- an error toast: `page.evaluate(() => { setTimeout(() => Promise.reject(new Error('e2e'))) })`.<br><br>Add these where the mock allows them:<br>- info: an edited toot deleted from the list;<br>- warning: an edit whose old version cannot be deleted (`deleteFails`).<br><br>The unit test in Task 2 covers every type's colours | No `color-contrast` violation; none `serious` or `critical`. Print any `moderate` finding: the dry run's probe saw only `region` on `.Vue-Toastification__toast-body`, because the library's container sits outside the landmarks (see residuals). Each toast's computed `background-color` is one of `rgb(51, 51, 51)`, `rgb(37, 119, 177)`, `rgb(255, 146, 0)` and `rgb(192, 57, 43)`, and its `font-family` contains `Nunito Sans` (Chromium quotes it, WebKit does not) |
| L5-4 | One list request. Account A with two scheduled toots; reset the mock log, sign in, wait for the composer and its two cards, then wait 1 s more. Then `page.reload()`, wait for the cards, then wait 1 s | `instance.calls('/api/v1/scheduled_statuses').filter(c => c.method === 'GET')` has length 1 after sign-in, and 2 after the reload: one per visit (Lot 4 sent 2 per visit). Adapt the filter to the shape of the mock's log entries |
| L5-5 | Uncaught error. On the composer, run `page.evaluate(() => { setTimeout(() => Promise.reject(new Error('e2e-1'))); setTimeout(() => Promise.reject(new Error('e2e-2')), 50); })` | Exactly one toast reads `Something went wrong. Please try again, or reload the page if it keeps happening.`, and the assertive live region (`[role="alert"][aria-live="assertive"]`) carries the same text. The page keeps working: the composer's text box still accepts input |
| L5-6 | No token in the console. On the composer, run `page.evaluate(() => { setTimeout(() => Promise.reject({ config: { headers: { Authorization: 'Bearer e2e-secret' } } })); })`. Also make the mock answer `500` to one list reload (`deleteFails`, then a deletion) | Over the **whole run**, no console line or `pageerror` contains `Authorization`, `Bearer` or `e2e-secret`. Add this to the #10 assertion. The dry run's probe saw no console line at all after the rejection: production has no console, and `preventDefault()` keeps the browser's own "Uncaught (in promise)" away |
| L5-7 | Page shell. On a fresh landing page | `meta[name="description"]` and `meta[name="theme-color"][content="#ffffff"]` are present; `og:type`, `og:title`, `og:description` and `og:url` are present, with `og:url` = `https://www.regulardesigner.com/toots-scheduler/`. No request goes to `vite.svg` |

The existing checks need no change. #10 keeps excusing only the browser's network notices; L5-6 adds its token assertion there. L3-8 keeps its CSP listener over every new flow.

- [ ] **Step 3: Run**

```bash
npm run build
npx vite preview --port 4173 --strictPort &   # in the repo
node e2e.mjs                                  # in the scratchpad e2e/ folder
BROWSER=webkit node e2e.mjs
```

Expected: `48/48 passed` (Chromium) and `49/49 passed` (WebKit). In the dry run, the existing suite gave 41/41 and 42/42 on this plan's final build, before the L5 checks were added.

Look at the screenshots in `e2e/shots/`, including the landing hero, the composer and each dialog. Fonts must look the same as before: same weights, same widths, no fallback font, except for "Русский" in the language list, which now uses the system font. Toasts must be in the new colours.

- [ ] **Step 4: Report to the user**

Report:
- the gates;
- the font sizes: 1,338,219 → 129,704 bytes in `dist/assets`;
- the depcheck result;
- both suite totals;
- the dry run's local Lighthouse numbers: mobile 69 → 96, desktop 98 → 100, on `vite preview`.

Only the user can check this:
1. **Lighthouse performance ≥ 90** on the landing page, desktop and mobile, preferably on the deployed site after the merge, or on `npm run build && npx vite preview`. Use Chrome DevTools → Lighthouse → Performance, in an incognito window so extensions don't skew it.

**User Verification Required:**
Before marking this task complete, you MUST call AskUserQuestion:
```yaml
AskUserQuestion:
  question: "The automated checks pass (438 unit tests, fonts at about 130 KB in WOFF2, depcheck clean, the Playwright suite in Chromium and WebKit with the Lot 5 checks: fonts, scroll lock, toast contrast, one list request, the error toast, no token in the console, meta tags). Does Lighthouse performance reach at least 90 on the landing page, desktop and mobile?"
  header: "Verification"
  options:
    - label: "Both at 90 or more"
      description: "Lot 5 is validated: close and publish the PR"
    - label: "Below 90"
      description: "Tell me the scores and the top opportunities Lighthouse lists; back to fixing, then re-verification"
    - label: "Publish, check later"
      description: "Publish the PR now, with the Lighthouse check left unchecked in its test plan"
```

```json:metadata
{"files": [], "verifyCommand": "node e2e.mjs", "acceptanceCriteria": ["test (438), typecheck, lint (0 problems), build pass", "dist: two woff2, no ttf, under 300 KB", "depcheck: no issue", "Playwright: 41/42 existing checks + L5-1..L5-7 (fonts, scroll lock, toast contrast, one list request, error toast, no token in console, meta): 48/48 Chromium, 49/49 WebKit", "zero CSP violations", "user informed and Lighthouse performance >= 90 checked on the landing page, desktop and mobile"], "requiresUserVerification": true, "userVerificationPrompt": "The automated checks pass (438 unit tests, fonts at about 130 KB in WOFF2, depcheck clean, the Playwright suite in Chromium and WebKit with the Lot 5 checks: fonts, scroll lock, toast contrast, one list request, the error toast, no token in the console, meta tags). Does Lighthouse performance reach at least 90 on the landing page, desktop and mobile?"}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. Push `fix/lot-5-performance-hygiene` and open the PR against `fix/lot-4-a11y-instance-limits`, or against `main` if Lot 4 has been merged. The PR test plan lists the Task 9 checks and the Lighthouse check. Once it is merged, mark Lot 5 as delivered in the spec, as for the earlier lots.

## Self-review notes

- **Spec coverage (Lot 5):**
  - **Fonts (WEB-02), Task 1:**
    - WOFF2, subset to Latin and Latin Extended;
    - variable fonts kept: Nunito `wght` and `opsz`, Winky `wght`;
    - every TTF removed: 4 variable and 14 static;
    - 129,704 bytes in `dist/assets` (81,844 Nunito Sans + 47,860 Winky Sans; 127,568 in the dry run, before the licence name records and combining marks were kept) against a 300 KB target. It was 1,338,219 bytes;
    - the font usage was checked first: weights 400 to 900, no italic, three utility classes;
    - the tool: fontTools and brotli in a pinned throw-away venv. The exact commands and the expected sizes are in Step 2, and the conversion was run in the dry run;
    - the binaries are committed.
  - **Global error handling (WEB-05), Task 4:**
    - `app.config.errorHandler` and `unhandledrejection`;
    - a generic toast through `useNotify`;
    - logs in DEV only, through Task 3's `logError`.
  - **`index.html` (WEB-06), Task 2:**
    - meta description, `theme-color` and minimal Open Graph;
    - `public/vite.svg` and `src/assets/vue.svg` removed;
    - the favicon checked: an inline SVG emoji, allowed by `img-src data:`, kept.
  - **Constants (CC-04), Task 5:**
    - the languages shared by TootCard and ControlsBar, and the default limits, are moved to `constants.ts`;
    - the OAuth scopes and the redirect URI were already there (Lot 2).
  - **`features.ts` (CC-09, CC-07), Task 6:**
    - `JSON.parse` in `try`/`catch` with a fallback, plus a zod check of the shape;
    - `recentNewFeatures`;
    - `APP_VERSION` removed: it was unused.
  - **Dependencies (CC-08), Task 6:** `@vueuse/components` and `@vueuse/core` removed; `npx depcheck` is clean.
  - **`eslint.config.js`, Task 3:** the `*.config.{js,ts}` block with `globals.node`.
  - **Cleanup (CC-07, CC-06):**
    - the duplicated JSDoc in returned objects is purged (Task 6);
    - the media toggle and the `'Alt' : 'Alt'` ternary are simplified (Task 5);
    - the "For testing" comment was already gone (Lot 2).
  - **Carry-overs:**
    - double list fetch → Task 7;
    - toast contrast → Task 2, with the contrast ratios computed by a unit test and checked by axe in Task 9;
    - bearer token in logs → Task 3. Every `console.error` call site is replaced, the two `console.log` calls that printed the account are removed, and `no-console` is now an error;
    - test-only exports (`DEFAULT_IMAGE_LIMITS`, `setLoading`, `instance.load`) → Task 5;
    - `id="schedule-button"` → Task 5;
    - `MastodonStatus` → Task 7: feasible, done;
    - `src/style.css` → Task 2. It was verified unused, and its `body.modal-open` rule was verified **missing from the production CSS**, so the scroll lock was broken. The rule moved to `App.vue`'s global style, and the file was deleted.
  - **Release and verification:**
    - release → Task 8, 0.16.1;
    - controller verification → Task 9: gates, font size, depcheck, Playwright in Chromium and WebKit with seven new checks, and Lighthouse by the user.
  - **Spec "Files":** the spec lists `src/composables/useSessionTimeout.ts`. Its WEB-03 work (throttling, no "For testing" comment) shipped in Lot 2, and nothing is left for it in this lot.
- **Deviations (justified):**
  - **Version 0.16.1, not 0.17.0.** The changelog skill's rules make this a PATCH: performance fixes, bug fixes and small improvements, and no new user-visible feature. The error toast fixes WEB-05's silent failure; it is not a feature.
  - **`format('woff2')` instead of `format('woff2-variations')`.**
    - The `-variations` hint is the deprecated form of `format(woff2) tech(variations)`.
    - Every browser that reads WOFF2 applies the variation axes of a file declared `woff2`.
    - It is what Google Fonts serves for variable fonts.
  - **Fewer axes and files than the TTFs had:**
    - Nunito's `wdth` and `YTLC` are pinned to the values the CSS always set (100 and 500), so rendering is unchanged. That saves 51 KB; `font-variation-settings` is removed from `:root` since those axes no longer exist;
    - `opsz` is kept, because two texts are set below 12 px;
    - italics are dropped, because none is used, and `font-synthesis: none` already ruled out faux italics;
    - one file per family covers both ranges, with no `unicode-range` split: Latin Extended costs a few KB, and a second request would cost more.
  - **The subsets keep more than planned (task review):** `--name-IDs='*'` keeps the copyright and OFL licence name records (OFL §2), and `--unicodes` adds the combining marks U+0300–036F. Shipped size: 81,844 + 47,860 = **129,704 bytes** (127,568 in the dry run). `fonts.test.ts` also pins the weight ranges (200 1000, 300 900) and `font-display: swap` (5 tests, not 4).
  - **`fonts.css` keeps only the three utility classes in use.** The 20 other `.nunito-sans-*` and `.winky-sans-*` classes were never referenced.
  - **Vitest `test.css.include`.** Without it, `?raw` CSS imports are empty strings in tests. It is limited to `src/assets/styles/`.
  - **`useGlobalErrorHandler` is a composable called from `main.ts`**, rather than inline code:
    - it listens with `addEventListener('unhandledrejection')`, which leaves `window.onunhandledrejection` free;
    - it is testable and can be uninstalled;
    - it adds a 5 s toast throttle and `preventDefault()` on rejections, so the browser never logs the raw reason, which can be an AxiosError with the token.
  - **The global handler goes further than planned (task review):**
    - the toast is deferred with `nextTick`: the toast container mounts on the tick after `app.use(Toast)`, so an error thrown during the first mount would otherwise toast into nothing. `useGlobalErrorHandler.mount.test.ts` checks it with the real plugin;
    - a window `error` listener also catches exceptions thrown in raw timer callbacks. It ignores events with no error object (cross-origin "Script error.", the ResizeObserver notice) and does not call `preventDefault()`. `uninstall` removes both listeners. 8 unit tests + 1 mount test, not 6.
  - **`no-console` is now `error`, not `warn`.** It enforces the logging rule; `logError.ts` holds the one sanctioned call.
  - **`logError` differs from the plan's single string (task review):**
    - in DEV a plain Error also passes its stack as a second argument. A stack holds only `name: message` and frame locations; an AxiosError stays one line;
    - `parseApiResponse` logs zod issues as `path: code` joined by `; `, never the received value, which a ZodError message can quote;
    - the ESLint Node-globals block matches `*.config.{js,ts,mjs,mts,cjs,cts}`.
  - **Toast styling:**
    - palette mapping: success and default `#333`, info `#2577b1`, warning `#FF9200` with `#333` text, error `#c0392b`;
    - the close button at 0.8 opacity in the text colour, with a visible `:focus-visible` outline (`2px solid currentColor`), because the library removes the outline (WCAG 2.4.7; task review);
    - toasts in the app font.

    A unit test computes every ratio and checks that only palette colours are used.
  - **Scroll lock rule in `App.vue`'s unscoped `<style>`**, the stylesheet that already holds the app's global rules (`*`, `:root`, `.visually-hidden`), rather than in a new global file.
  - **More files deleted than listed:** `src/types/svg.d.ts`, since nothing imports an SVG in TypeScript and `vite/client` declares `*.svg` anyway, and the two Google Fonts `README.txt` files, which described the TTFs. Both `OFL.txt` licences stay.
  - **Renamed constants:** `MAX_IMAGE_BYTES` → `DEFAULT_MAX_IMAGE_BYTES` and `MAX_IMAGES_PER_TOOT` → `DEFAULT_MAX_MEDIA_ATTACHMENTS`, in line with `DEFAULT_MAX_CHARACTERS`. They are defaults, overridden by the instance. `SUPPORTED_IMAGE_TYPES` is typed `readonly string[]`. The ControlsBar test pins `en` first and the 14 shared languages.
  - **`setError` is no longer exported** from the scheduled toots store (final review): nothing outside the store used it, like `setLoading`.
  - **The features store validates the saved shape with zod** (already a dependency), not just `JSON.parse`. Each field falls back on its own (`.catch`): a wrong `lastSeenVersion` keeps the releases seen, which a test pins. Writing is wrapped too. A test pins the changelog invariants (package version, unique ids and versions), which the changelog skill now mentions.
  - **Skills updated:**
    - `changelog`, which named `APP_VERSION` and `lastThreeNewFeatures`;
    - `vue3-codegen`, which asked for JSDoc in the returned object, the duplication the spec removes;
    - `web-security` (final review): errors are logged with `src/utils/logError.ts` only, and `no-console` is an error.
  - **`MastodonStatus` keeps its name.** Renaming it to `ScheduledStatus` would touch about ten more files for no behaviour change. A plain `as MastodonStatus[]` cast remains in `getScheduledToots`: the schema passes some params through unchecked (see residuals).
  - **`sensitive` is now checked by the schema (beyond the plan, ce71f77 and 0e3e0f8).** Mastodon echoes it as the client sent it. The schema reads it as Mastodon casts it at publish time (Rails boolean): blank → unset; `0`, `f`, `false`, `off` (and their upper-case forms) → false; anything else → true. A number is false only when 0. Any other type is refused. So a toot scheduled from a form-posting client no longer shows a content warning for `"false"`, and one odd value (`"1"`, `"on"`) never hides the whole list.
  - **TootCard's `spoiler_text` prop became `spoilerText`.** That was the last lint warning; lint now reports 0 problems.
  - **Release 0.16.1 has five What's New entries, not four:** `content-warning-from-other-apps` covers the `sensitive` fix, which users can see. The first entry says "about half a megabyte less", not "about 1 MB": only the two upright variable TTFs were ever downloaded (the dry run measured 779 → 245 KiB transferred).
  - **Not done, because not needed:** lazy-loading the composer route. The dry run's Lighthouse already scores 96 on mobile and 100 on desktop.
- **Known residuals:**
  - **Non-Latin scripts use the system font:** Cyrillic, Greek, CJK and so on. Vietnamese and combining marks are covered by Nunito Sans (the body font); Winky Sans, used for headings, has no Vietnamese glyphs in its source. In the UI this only affects "Русский" in the language list. A toot written in those scripts shows in the system sans-serif, in the composer and on the cards. A Cyrillic subset with `unicode-range` would load only when needed, if wanted later.
  - **Font files are not byte-reproducible:** the instancer's Nunito output varies by a few bytes between runs. Winky's is identical. The tool versions are pinned in Task 1 and the recipe is in `fonts.css`.
  - **Toasts sit outside the page landmarks.** axe reports a `moderate` `region` finding on `.Vue-Toastification__toast-body` while a toast is shown; the library appends its container to `<body>`. Toasts are not live regions (Lot 4), and every message is also spoken from App's live regions.
  - **What the global handler leaves out:** Vue errors, unhandled rejections and window `error` events that carry an error object all reach it. Error events without one (cross-origin "Script error.", browser notices) are ignored on purpose. Window `error` events are not prevented, so the browser still prints "Uncaught …" (the error's text and stack) in production. A render error in a component still leaves that component empty; the toast says something went wrong.
  - **`theme-color` is white only.** The app has no dark mode, which is still not addressed, as in Lot 4. There is no `og:image`; link previews show the title and description.
  - **Unchecked params:** `MastodonStatus.params.spoiler_text`, `language` and the poll's `expires_in`/`multiple`/`hide_totals` are typed as Mastodon documents them, but the schema does not check them. The card and the composer read them as they come. (`sensitive` is now checked; see Deviations.)
  - **Lighthouse was measured locally only** (`vite preview`, Lighthouse 12). The deployed site, behind GitHub Pages' CDN and compression, is the user's check in Task 9.
  - Lot 4 residuals not in this lot's scope remain:
    - closing the media section keeps the images;
    - dialogs do not make the page `inert`;
    - the mobile menu has no focus trap.

    The scroll lock now ships, so Lot 4's residual "`overflow: hidden` on `<body>`, which iOS Safari may not honour" applies for real.
