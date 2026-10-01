# Lot 0 — Quality Gate & CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make type errors, lint errors, failing tests and vulnerable runtime dependencies block the build and the GitHub Pages deploy.

**Architecture:** `vue-tsc -b` replaces the no-op `vue-tsc` so the solution-style `tsconfig.json` really type-checks `src/`. Vitest (configured inside `vite.config.ts`, happy-dom environment) and ESLint flat config are added as dev tooling. The GitHub Actions workflow is split into a `verify` job (lint → typecheck → test → audit → build) and a `deploy` job that only runs on `main` after `verify` passes.

**Tech Stack:** Vue 3.5, TypeScript 5.7, Vite 6.4, vue-tsc 2.2, Vitest 4.1, @vue/test-utils 2.4, happy-dom 20, ESLint 9 + eslint-plugin-vue 10 + typescript-eslint 8, GitHub Actions, Node 22.

**User Verification:** NO — the spec requires human verification only for Lots 1, 2 and 3. Pushing to `main` deploys to production, so the final merge or push is left to the user via `finishing-a-development-branch`.

**Source spec:** [docs/superpowers/specs/2026-10-01-red-team-remediation-design.md](../specs/2026-10-01-red-team-remediation-design.md), Lot 0 (findings CC-01, CC-02, SEC-01, SEC-10 in [docs/audits/2026-10-01-red-team-report.md](../../audits/2026-10-01-red-team-report.md)).

---

## Context the engineer needs

- **Why the build is green today despite type errors:** `tsconfig.json` is a "solution" file (`"files": []` + `references`). Plain `vue-tsc` on it checks nothing. Only `vue-tsc -b` (build mode) follows the references. Today, `npx vue-tsc -b` reports 5 errors.
- **npm 10 bug:** with the local npm (10.9.x), `npm install -D vitest@^4` crashes with `Cannot read properties of null (reading 'edgesOut')` (arborist peer-set bug). Use **npm 11 via npx** for the install commands that add dependencies (`npx -y npm@11 install -D …`). The lockfile it writes (lockfileVersion 3) installs fine with npm 10's `npm ci`. This was verified, so CI and teammates are unaffected.
- **Two lockfiles:** `yarn.lock` and `package-lock.json` both exist. CI uses npm, and every npm install rewrites `yarn.lock`. Delete `yarn.lock`.
- **`VITE_*` env vars are unused:** `grep -rn "import.meta.env" src` only finds `BASE_URL`. `VITE_MASTODON_CLIENT_SECRET` in CI is dead, but would be **bundled publicly** if ever referenced, so remove it.
- **Everything below was dry-run on a scratch copy of the repo:** all commands and expected outputs come from that run.
- **Project skills:** read `.claude/skills/vue3-codegen/SKILL.md` before touching `.vue`/`.ts` files (Tasks 2–4) and `.claude/skills/changelog/SKILL.md` for Task 6.

## File map

| File | Action | Responsibility |
|---|---|---|
| `yarn.lock` | Delete | Single lockfile policy |
| `package.json` | Modify | Scripts, devDeps, `engines` |
| `package-lock.json` | Modify (generated) | Pinned dependency tree |
| `.nvmrc` | Create | Node version for devs and CI |
| `src/components/ContentWarning.vue` | Modify | Drop unused `props` binding |
| `src/composables/useMastodonApi.ts` | Modify | Drop unused `axios` import and unused catch binding |
| `src/router/index.ts` | Modify | Return-style navigation guard (no unused `from`/`next`) |
| `src/components/Toot/TootCard.vue` | Modify | Correct `poll` and `onDelete` prop types |
| `src/App.vue` | Modify | Drop unused catch binding |
| `src/types/vue.d.ts` | Delete | Redundant `*.vue` shim (vue-tsc handles SFCs) that violates `no-empty-object-type` |
| `vite.config.ts` | Modify | Vitest `test` block |
| `src/utils/url.test.ts` | Create | Smoke and characterization tests for `normalizeUrl` |
| `src/components/Modals/DeleteConfirmModal.test.ts` | Create | First component test (validates @vue/test-utils + happy-dom) |
| `eslint.config.js` | Create | ESLint flat config |
| `src/**/*.vue` (several) | Modify (auto) | One-off `eslint --fix` formatting |
| `.github/workflows/deploy.yml` | Modify | `verify` gate + `deploy` job |
| `.env.example` | Delete | Only documented unused `VITE_*` vars |
| `README.md` | Modify | Setup steps and quality commands |
| `CLAUDE.md` | Modify | Commands section for agents |
| `src/stores/features.ts` | Modify | 0.13.1 release entry |

---

### Task 1: Dependency hygiene and single lockfile

**Goal:** Remove all high/critical runtime vulnerabilities (axios credential-theft CVEs) and keep only the npm lockfile.

**Files:**
- Delete: `yarn.lock`
- Modify: `package.json`, `package-lock.json`
- Create: `.nvmrc`

**Acceptance Criteria:**
- [ ] `yarn.lock` no longer exists
- [ ] `npm ls axios` shows `axios@1.20.0` or later
- [ ] `npm audit --omit=dev --audit-level=high` prints `found 0 vulnerabilities`
- [ ] `npm run build` still succeeds
- [ ] `package.json` declares `"engines": { "node": ">=22" }` and `.nvmrc` contains `22`

**Verify:** `npm audit --omit=dev --audit-level=high` → `found 0 vulnerabilities`

**Steps:**

- [ ] **Step 1: Create the working branch and commit the audit docs**

```bash
git checkout -b chore/lot-0-quality-gate
git add docs/audits/2026-10-01-red-team-report.md \
        docs/superpowers/specs/2026-10-01-red-team-remediation-design.md \
        docs/superpowers/plans/2026-10-01-lot-0-quality-gate.md \
        docs/superpowers/plans/2026-10-01-lot-0-quality-gate.md.tasks.json
git commit -m "docs: add red team audit, remediation spec and Lot 0 plan"
```

- [ ] **Step 2: Record the failing baseline**

Run: `npm audit --omit=dev --audit-level=high`
Expected: non-zero exit, listing `axios  1.0.0 - 1.19.0  Severity: high` among others.

- [ ] **Step 3: Delete the Yarn lockfile**

```bash
git rm yarn.lock
```

- [ ] **Step 4: Apply the audit fixes (stays within existing semver ranges)**

```bash
npm audit fix
```

Expected tail: `found 0 vulnerabilities`. `npm ls axios vite --depth=0` shows `axios@1.20.0` (or later) and `vite@6.4.3` (or later 6.x).

- [ ] **Step 5: Pin the Node version**

Create `.nvmrc`:

```
22
```

In `package.json`, add an `engines` field right after `"type": "module",`:

```json
  "type": "module",
  "engines": {
    "node": ">=22"
  },
```

- [ ] **Step 6: Verify the build still works**

Run: `npm run build`
Expected: ends with `✓ built in …`.

Run: `npm audit --omit=dev --audit-level=high`
Expected: `found 0 vulnerabilities`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc
git commit -m "chore(deps): fix axios and vite advisories, drop yarn.lock, pin Node 22"
```

```json:metadata
{"files": ["yarn.lock", "package.json", "package-lock.json", ".nvmrc"], "verifyCommand": "npm audit --omit=dev --audit-level=high", "acceptanceCriteria": ["yarn.lock deleted", "axios >= 1.20.0", "npm audit --omit=dev --audit-level=high reports 0 vulnerabilities", "npm run build succeeds", "engines.node >=22 and .nvmrc = 22"], "requiresUserVerification": false}
```

---

### Task 2: Make the typecheck real and fix the 5 hidden errors

**Goal:** `npm run build` and `npm run typecheck` run `vue-tsc -b`, so a type error fails the build. The 5 existing errors are fixed.

**Files:**
- Modify: `package.json` (scripts)
- Modify: `src/components/ContentWarning.vue:2`
- Modify: `src/composables/useMastodonApi.ts:1`
- Modify: `src/router/index.ts:32-48`
- Modify: `src/components/Toot/TootCard.vue:1-18`

**Acceptance Criteria:**
- [ ] `package.json` has `"build": "vue-tsc -b && vite build"` and `"typecheck": "vue-tsc -b"`
- [ ] `npm run typecheck` exits 0 with no output
- [ ] Adding `export const broken: number = 'x';` to any file under `src/` makes `npm run build` exit non-zero
- [ ] Router behavior unchanged: an unauthenticated user visiting `/composer` lands on `/`, and an authenticated user visiting `/` lands on `/composer`

**Verify:** `npm run typecheck; echo "exit=$?"` → `exit=0`

**Steps:**

- [ ] **Step 1: Switch the scripts to build mode**

In `package.json`, replace the `scripts` block with:

```json
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc -b"
  },
```

- [ ] **Step 2: Run the typecheck and watch it fail**

Run: `npm run typecheck`
Expected: FAIL with exactly these 5 errors:

```
src/components/ContentWarning.vue(2,7): error TS6133: 'props' is declared but its value is never read.
src/components/Toot/ScheduledToots.vue(118,14): error TS2322: Type '{ options: string[]; expires_in: number; ... }' is not assignable to type '{ id: string; options: { id: string; text: string; }[]; }'.
src/components/Toot/ScheduledToots.vue(121,14): error TS2322: Type '(id: string) => void' is not assignable to type '(id: string) => Promise<void>'.
src/composables/useMastodonApi.ts(1,1): error TS6133: 'axios' is declared but its value is never read.
src/router/index.ts(33,24): error TS6133: 'from' is declared but its value is never read.
```

- [ ] **Step 3: Fix `ContentWarning.vue`**

In `src/components/ContentWarning.vue`, line 2, the props are only used in the template, so drop the binding:

```ts
defineProps<{
  modelValue: boolean;
  spoilerText: string;
}>();
```

(This replaces `const props = defineProps<{`. The rest of the block is unchanged.)

- [ ] **Step 4: Fix `useMastodonApi.ts`**

Delete line 1 of `src/composables/useMastodonApi.ts`:

```ts
import axios from 'axios';
```

The file must now start with `import { createApiClient } from '../utils/api';`.

- [ ] **Step 5: Fix `router/index.ts` with a return-style guard**

Replace everything from `// Navigation guard` to the end of `src/router/index.ts` with:

```ts
// Navigation guard
router.beforeEach((to) => {
  const auth = useAuthStore();

  // If trying to access composer without auth, redirect to home
  if (to.meta.requiresAuth && !auth.accessToken) {
    return { name: 'home' };
  }

  // If authenticated and trying to access home, redirect to composer
  if (to.name === 'home' && auth.accessToken) {
    return { name: 'composer' };
  }
});

export default router;
```

Returning `undefined` means "continue". This is the Vue Router 4 recommended form, and it replaces the `next()` callback.

- [ ] **Step 6: Fix the `TootCard.vue` prop types**

In `src/components/Toot/TootCard.vue`, add the type import after the `vue` import:

```ts
import { format } from 'date-fns';
import { ref, computed } from 'vue';
import type { ScheduledToot } from '../../types/mastodon';
```

In `interface Props`, replace these two lines:

```ts
  poll?: { id: string; options: Array<{ id: string; text: string }> };
```
```ts
  onDelete: (id: string) => Promise<void>;
```

with:

```ts
  poll?: ScheduledToot['poll'];
```
```ts
  onDelete: (id: string) => void;
```

(`TootCard` only checks whether `poll` is truthy, so no template change is needed. The `poll` data passed in is `toot.params.poll`, whose shape is `ScheduledToot['poll']`.)

- [ ] **Step 7: Run the typecheck again**

Run: `npm run typecheck; echo "exit=$?"`
Expected: no error output, `exit=0`.

- [ ] **Step 8: Prove that the gate now bites**

```bash
echo "export const broken: number = 'x';" > src/utils/broken.ts
npm run build; echo "exit=$?"
rm src/utils/broken.ts
```

Expected: `error TS2322` on `src/utils/broken.ts`, then `exit=2` (any non-zero value is fine).

- [ ] **Step 9: Smoke-test the router change manually**

Run: `npm run dev`, open `http://localhost:5173/toots-scheduler/composer` in a private window (no stored token).
Expected: you land on the landing page (`/toots-scheduler/`). Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add package.json src/components/ContentWarning.vue src/composables/useMastodonApi.ts src/router/index.ts src/components/Toot/TootCard.vue
git commit -m "fix(types): run vue-tsc in build mode and fix 5 hidden type errors"
```

```json:metadata
{"files": ["package.json", "src/components/ContentWarning.vue", "src/composables/useMastodonApi.ts", "src/router/index.ts", "src/components/Toot/TootCard.vue"], "verifyCommand": "npm run typecheck", "acceptanceCriteria": ["build script uses vue-tsc -b", "npm run typecheck exits 0", "a deliberate type error fails npm run build", "router redirects unchanged"], "requiresUserVerification": false}
```

---

### Task 3: Vitest setup with first unit and component tests

**Goal:** `npm test` runs Vitest (happy-dom) and passes a smoke test for a pure util and for a component.

**Files:**
- Modify: `package.json` (devDeps, scripts)
- Modify: `vite.config.ts`
- Create: `src/utils/url.test.ts`
- Create: `src/components/Modals/DeleteConfirmModal.test.ts`

**Acceptance Criteria:**
- [ ] `vitest@^4.1`, `@vue/test-utils@^2.4`, `happy-dom@^20` are in `devDependencies`
- [ ] `npm test` reports `Test Files  2 passed (2)` and `Tests  7 passed (7)`
- [ ] `npm run typecheck` still exits 0 (test files are type-checked too, since `tsconfig.app.json` includes `src/**/*.ts`)
- [ ] Temporarily breaking an assertion makes `npm test` exit non-zero

**Verify:** `npm test` → `Tests  7 passed (7)`

**Steps:**

- [ ] **Step 1: Install the test tooling (with npm 11, see Context)**

```bash
npx -y npm@11 install -D vitest@^4.1 @vue/test-utils@^2.4 happy-dom@^20
```

Expected: `npm ls vitest --depth=0` shows `vitest@4.1.x`. An `npm warn install-scripts` notice from npm 11 is expected and harmless.

- [ ] **Step 2: Add the test scripts**

In `package.json` `scripts`, add after `"typecheck"`:

```json
    "typecheck": "vue-tsc -b",
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

Replace the whole of `vite.config.ts` with:

```ts
/// <reference types="node" />
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/toots-scheduler/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
})
```

Convention: test files sit next to the file under test, named `<name>.test.ts`. Always import `describe`/`it`/`expect` from `'vitest'` explicitly (no globals).

- [ ] **Step 4: Write the `normalizeUrl` tests**

Create `src/utils/url.test.ts`:

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
});
```

These are characterization tests of current behavior. HTTPS enforcement comes in Lot 2, and these tests will be extended then.

- [ ] **Step 5: Write the `DeleteConfirmModal` tests**

Create `src/components/Modals/DeleteConfirmModal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DeleteConfirmModal from './DeleteConfirmModal.vue';

describe('DeleteConfirmModal', () => {
  it('renders the toot preview as text', () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: '<b>Hello</b>' } });
    expect(wrapper.find('.toot-preview').text()).toBe('<b>Hello</b>');
    expect(wrapper.find('.toot-preview b').exists()).toBe(false);
  });

  it('hides the preview block when the preview is empty', () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: '' } });
    expect(wrapper.find('.toot-preview').exists()).toBe(false);
  });

  it('emits confirm when Delete is clicked', async () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: 'x' } });
    await wrapper.find('.btn-delete').trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('emits cancel when Cancel is clicked', async () => {
    const wrapper = mount(DeleteConfirmModal, { props: { tootPreview: 'x' } });
    await wrapper.find('.btn-cancel').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
```

The first test is a security regression test: toot text must be rendered escaped, never as HTML.

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected:

```
 Test Files  2 passed (2)
      Tests  7 passed (7)
```

- [ ] **Step 7: Prove that the tests can fail**

Temporarily change `'https://mastodon.social'` in the first `url.test.ts` assertion to `'https://wrong.example'`.
Run: `npm test; echo "exit=$?"`
Expected: `1 failed`, `exit=1`. Revert the change, then run `npm test` again → `7 passed`.

- [ ] **Step 8: Typecheck the new files**

Run: `npm run typecheck; echo "exit=$?"`
Expected: `exit=0`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/utils/url.test.ts src/components/Modals/DeleteConfirmModal.test.ts
git commit -m "test: add Vitest with happy-dom and first unit/component tests"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "vite.config.ts", "src/utils/url.test.ts", "src/components/Modals/DeleteConfirmModal.test.ts"], "verifyCommand": "npm test", "acceptanceCriteria": ["vitest, @vue/test-utils, happy-dom in devDependencies", "npm test: 2 files, 7 tests passed", "npm run typecheck exits 0", "a broken assertion fails npm test"], "requiresUserVerification": false}
```

---

### Task 4: ESLint flat config, fix lint errors, one-off auto-format

**Goal:** `npm run lint` exits 0 (no errors). `v-html` is forbidden, and `console`/`any` are flagged as warnings for the later lots.

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json` (devDeps, scripts)
- Modify: `src/App.vue:40`, `src/composables/useMastodonApi.ts` (the `catch (error)` in `uploadMedia`)
- Delete: `src/types/vue.d.ts`
- Modify (auto-fix, second commit): `.vue` files reformatted by `eslint --fix`

**Acceptance Criteria:**
- [ ] `npm run lint` exits 0, with **0 errors**. Exactly 12 warnings remain after the auto-fix (7× `no-console`, 4× `no-explicit-any`, 1× `vue/prop-name-casing`): they are tracked for Lots 2 and 4 and must not be "fixed" here
- [ ] Adding `<div v-html="x" />` to any component makes `npm run lint` exit non-zero
- [ ] `npm run typecheck`, `npm test` and `npm run build` all pass after the auto-fix commit
- [ ] Logic fixes and formatting are in **two separate commits**

**Verify:** `npm run lint; echo "exit=$?"` → `✖ 12 problems (0 errors, 12 warnings)` and `exit=0`

**Steps:**

- [ ] **Step 1: Install the lint tooling (with npm 11, see Context)**

```bash
npx -y npm@11 install -D eslint@^9 @eslint/js@^9 eslint-plugin-vue@^10 typescript-eslint@^8 globals@^16
```

Expected: `npm ls eslint --depth=0` shows `eslint@9.x`.

- [ ] **Step 2: Add the lint scripts**

In `package.json` `scripts`, add after `"test:watch"`:

```json
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
```

- [ ] **Step 3: Create `eslint.config.js`**

```js
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Security: API data (toots, display names) must never be rendered as HTML.
      'vue/no-v-html': 'error',
      // Tracked for Lot 2 (dev-only logger) and Lot 3 (typed API responses).
      'no-console': ['warn', { allow: ['error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Single-word names (App, Send) are an existing convention in this project.
      'vue/multi-word-component-names': 'off',
    },
  },
)
```

- [ ] **Step 4: Run the linter and watch it fail**

Run: `npm run lint`
Expected: exit 1 with **4 errors** (plus about 230 auto-fixable warnings):

```
src/App.vue:40                      @typescript-eslint/no-unused-vars   'error' is defined but never used.
src/composables/useMastodonApi.ts   @typescript-eslint/no-unused-vars   'error' is defined but never used.   (inside uploadMedia's JSON.parse try/catch)
src/types/vue.d.ts:3  (×2)          @typescript-eslint/no-empty-object-type
```

(The `ContentWarning.vue` `props` and the `axios` import errors are gone thanks to Task 2. If they still appear, Task 2 is incomplete.)

- [ ] **Step 5: Fix the unused catch bindings**

In `src/App.vue`, inside `sendThanksNotification`, replace:

```ts
  } catch (error) {
    toast.error('Failed to send thanks. Please try again later.');
  }
```

with:

```ts
  } catch {
    toast.error('Failed to send thanks. Please try again later.');
  }
```

In `src/composables/useMastodonApi.ts`, inside `uploadMedia`'s `load` listener, replace:

```ts
          } catch (error) {
            reject(new Error('Failed to parse response'));
          }
```

with:

```ts
          } catch {
            reject(new Error('Failed to parse response'));
          }
```

- [ ] **Step 6: Delete the redundant `.vue` module shim**

```bash
git rm src/types/vue.d.ts
```

vue-tsc type-checks `.vue` imports natively, so the shim is unnecessary. Run `npm run typecheck; echo "exit=$?"` → `exit=0` to confirm.

- [ ] **Step 7: Re-run the linter**

Run: `npm run lint; echo "exit=$?"`
Expected: `0 errors`, `exit=0` (many warnings at this point, almost all formatting).

- [ ] **Step 8: Prove the `v-html` rule bites**

Temporarily add `<div v-html="'x'" />` inside the root `<div>` of `src/components/Modals/DeleteConfirmModal.vue`.
Run: `npm run lint; echo "exit=$?"`
Expected: `error  'v-html' directive can lead to XSS attack  vue/no-v-html`, `exit=1`. Revert the change.

- [ ] **Step 9: Commit the config and logic fixes**

```bash
git add eslint.config.js package.json package-lock.json src/App.vue src/composables/useMastodonApi.ts
git commit -m "chore(lint): add ESLint flat config, forbid v-html, fix lint errors"
```

(`src/types/vue.d.ts` was already staged by `git rm` in Step 6.)

- [ ] **Step 10: One-off auto-format**

```bash
npm run lint:fix
npm run lint; echo "exit=$?"
```

Expected: `✖ 12 problems (0 errors, 12 warnings)`, `exit=0`. The remaining warnings are `no-console` (7), `no-explicit-any` (4) and `vue/prop-name-casing` on `spoiler_text` (1). Leave them; they belong to Lots 2–4.

- [ ] **Step 11: Verify that the formatting changed nothing functionally**

```bash
npm run typecheck && npm test && npm run build
```

Expected: typecheck silent, `Tests  7 passed (7)`, `✓ built in …`.

Then run `npm run dev` and click through: landing → "Get started" opens the login modal → close it. Expected: no visual change and no console error. Stop the dev server.

- [ ] **Step 12: Commit the formatting separately**

```bash
git add -u src
git commit -m "style: apply eslint-plugin-vue recommended formatting (auto-fix only)"
```

```json:metadata
{"files": ["eslint.config.js", "package.json", "package-lock.json", "src/App.vue", "src/composables/useMastodonApi.ts", "src/types/vue.d.ts"], "verifyCommand": "npm run lint", "acceptanceCriteria": ["npm run lint exits 0 with 0 errors", "12 known warnings remain untouched", "v-html triggers a lint error", "typecheck, test and build pass after auto-fix", "logic fixes and formatting in separate commits"], "requiresUserVerification": false}
```

---

### Task 5: CI verify gate, remove unused build secrets, update docs

**Goal:** GitHub Actions runs lint → typecheck → test → audit → build on every PR and push. Deploy to Pages happens only from `main` after `verify` passes, with no `VITE_*` secrets in the build.

**Files:**
- Modify: `.github/workflows/deploy.yml` (full rewrite)
- Delete: `.env.example`
- Modify: `README.md` (sections "Prerequisites", "Installation", "Project Structure", "Development Workflow")
- Modify: `CLAUDE.md` (new "Commands" section)

**Acceptance Criteria:**
- [ ] Workflow has a `verify` job and a `deploy` job with `needs: verify`
- [ ] `deploy` only runs for `push`/`workflow_dispatch` on `refs/heads/main`, never for `pull_request`
- [ ] `grep -n "VITE_" .github/workflows/deploy.yml` returns nothing
- [ ] `.env.example` deleted; README no longer mentions `.env` or `VITE_MASTODON_SERVER`
- [ ] Workflow YAML parses (`npx -y js-yaml .github/workflows/deploy.yml` exits 0)
- [ ] Running the `verify` steps locally in order all pass

**Verify:** `npm ci && npm run lint && npm run typecheck && npm test && npm audit --omit=dev --audit-level=high && npm run build` → all succeed

**Steps:**

- [ ] **Step 1: Rewrite `.github/workflows/deploy.yml`**

Replace the whole file with:

```yaml
name: CI & Deploy

on:
  push:
    branches: ['main']
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Audit runtime dependencies
        run: npm audit --omit=dev --audit-level=high

      - name: Build
        run: npm run build

  deploy:
    needs: verify
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    permissions:
      contents: read
      pages: write
      id-token: write
    concurrency:
      group: 'pages'
      cancel-in-progress: true
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Notes: `pages: write` and `id-token: write` are now scoped to `deploy` only (least privilege). The `VITE_MASTODON_*` and `VITE_REDIRECT_URI` env entries are removed because nothing in `src/` reads them: the redirect URI is computed from `window.location.origin`. After merging, the repo secrets `VITE_MASTODON_SERVER`, `VITE_MASTODON_CLIENT_ID` and `VITE_MASTODON_CLIENT_SECRET` can be deleted in GitHub settings (user action, outside this plan).

- [ ] **Step 2: Validate the YAML syntax**

```bash
node -e "const y=require('fs').readFileSync('.github/workflows/deploy.yml','utf8'); if(!/needs: verify/.test(y)||/VITE_/.test(y)) process.exit(1); console.log('ok')"
npx -y js-yaml .github/workflows/deploy.yml > /dev/null && echo "yaml ok"
```

Expected: `ok`, then `yaml ok`.

- [ ] **Step 3: Delete `.env.example`**

```bash
git rm .env.example
```

- [ ] **Step 4: Update `README.md`**

In "Prerequisites", replace `- Node.js (v20 or later recommended)` with:

```markdown
- Node.js 22 (see `.nvmrc`; run `nvm use`)
```

In "Installation", replace steps 2 to 4 (from `2. Install dependencies:` through the closing fence of the `VITE_MASTODON_SERVER` env block) with:

````markdown
2. Install dependencies:
```bash
npm ci
```

No environment file is needed: the app registers itself on the Mastodon instance you sign in to.
````

After the "Building for Production" section, add:

````markdown
### Quality checks

These run in CI on every pull request and must pass before deploy:
```bash
npm run lint        # ESLint (v-html forbidden)
npm run typecheck   # vue-tsc -b
npm test            # Vitest
npm audit --omit=dev --audit-level=high
```
````

In "Project Structure", delete the line `` - `env.example`: Example environment configuration file ``.

In "Development Workflow", replace items 2 and 3 with:

```markdown
2. **Install Dependencies**: Run `npm ci` to install the locked dependencies.
3. **Run Quality Checks**: `npm run lint && npm run typecheck && npm test` before pushing.
```

- [ ] **Step 5: Add a Commands section to `CLAUDE.md`**

Insert before `## Project Structure`:

````markdown
## Commands

```bash
npm run dev         # dev server
npm run lint        # ESLint — must report 0 errors
npm run typecheck   # vue-tsc -b — must exit 0
npm test            # Vitest (tests live next to sources as *.test.ts)
npm run build       # typecheck + production build
```

Run lint, typecheck and test before every commit. CI blocks the deploy if any of them fails.
If `npm install -D <pkg>` crashes with `reading 'edgesOut'` (npm 10 bug), use `npx -y npm@11 install -D <pkg>`.

````

- [ ] **Step 6: Run the full verify sequence locally, as CI will**

```bash
rm -rf node_modules
npm ci && npm run lint && npm run typecheck && npm test && npm audit --omit=dev --audit-level=high && npm run build
echo "exit=$?"
```

Expected: lint `0 errors`, typecheck silent, `Tests  7 passed (7)`, `found 0 vulnerabilities`, `✓ built in …`, `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/deploy.yml README.md CLAUDE.md
git commit -m "ci: gate deploy on lint, typecheck, tests and audit; drop unused VITE secrets"
```

(`.env.example` was already staged by `git rm` in Step 3.)

```json:metadata
{"files": [".github/workflows/deploy.yml", ".env.example", "README.md", "CLAUDE.md"], "verifyCommand": "npm ci && npm run lint && npm run typecheck && npm test && npm audit --omit=dev --audit-level=high && npm run build", "acceptanceCriteria": ["verify job + deploy needs verify", "deploy only on main, never on pull_request", "no VITE_ in workflow", ".env.example deleted and README updated", "workflow YAML valid", "local verify sequence passes"], "requiresUserVerification": false}
```

---

### Task 6: Release 0.13.1 entry

**Goal:** Version bumped to 0.13.1, with a user-facing "What's New" entry for the security dependency update.

**Files:**
- Modify: `package.json` (`"version"`)
- Modify: `package-lock.json` (root `version` fields)
- Modify: `src/stores/features.ts` (prepend a `FeatureGroup`)

**Acceptance Criteria:**
- [ ] `package.json` `"version"` is `0.13.1`, and so is the first `FeatureGroup.version` in `src/stores/features.ts`
- [ ] The new feature `id` is unique across the whole `features` array
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` pass

**Verify:** `node -e "console.log(require('./package.json').version)"` → `0.13.1`

**Steps:**

- [ ] **Step 1: Read the changelog skill**

Read `.claude/skills/changelog/SKILL.md` in full and follow it. This is a PATCH bump (security fix, no new feature).

- [ ] **Step 2: Bump the version without creating a git tag**

```bash
npm version patch --no-git-tag-version
```

Expected output: `v0.13.1`. Both `package.json` and `package-lock.json` are updated.

- [ ] **Step 3: Check that the ID is unique**

Run: `grep -n "security-dependency-update" src/stores/features.ts`
Expected: no match.

- [ ] **Step 4: Prepend the release entry**

In `src/stores/features.ts`, insert at the very top of the `features` array (before the `version: '0.13.0'` group):

```ts
    {
      version: '0.13.1',
      date: '2026-10-01',
      features: [
        {
          id: 'security-dependency-update',
          title: '🔒 Security Updates',
          description: 'We updated the libraries Toot Scheduler relies on to close known security issues, and every new release is now automatically checked before it goes live.'
        },
      ],
    },
```

Use today's date if the work lands on a different day.

- [ ] **Step 5: Verify**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all pass (`0 errors`, `7 passed`, `✓ built`).

Run `npm run dev` and sign in (or clear the `masto-publish-later-features` key in localStorage while signed in). Expected: the "What's New" button appears, and the modal lists "In version 0.13.1" first. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/stores/features.ts
git commit -m "chore(release): 0.13.1 — security dependency updates and CI quality gate"
```

```json:metadata
{"files": ["package.json", "package-lock.json", "src/stores/features.ts"], "verifyCommand": "node -e \"console.log(require('./package.json').version)\"", "acceptanceCriteria": ["version 0.13.1 in package.json and features store", "unique feature id", "lint, typecheck, test, build pass"], "requiresUserVerification": false}
```

---

## After the last task

Use `superpowers-extended-cc:finishing-a-development-branch`. Recommended path: push the branch and open a PR. The new `verify` job runs on the PR and must be green; merging to `main` then triggers the deploy. Do **not** push directly to `main` without the user's go-ahead, because it deploys to production.

## Self-review notes

- **Spec coverage (Lot 0):** `vue-tsc -b` + 5 errors → Task 2. Vitest/test-utils/happy-dom + smoke test → Task 3. ESLint with `vue/no-v-html: error`, `no-console: warn`, `no-explicit-any: warn` → Task 4. CI `verify` gate + `needs` + PR trigger → Task 5. `npm audit fix`, axios bump → Task 1. `VITE_*` removal from CI and `.env.example` → Task 5. `yarn.lock` removal → Task 1. Release (cross-cutting principle 2) → Task 6.
- **Deliberate deviation from the spec:** the spec's "props callbacks → emits" refactor of `TootCard` stays in Lot 4. Task 2 only corrects the types, to keep this lot behavior-neutral.
- **Out of scope here (later lots):** the 12 remaining lint warnings, the `esbuild.drop` of console calls, and the mastodon-api skill's `idempotency` doc fix.
