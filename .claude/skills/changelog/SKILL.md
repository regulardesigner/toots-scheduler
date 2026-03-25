---
name: changelog
description: >
  Changelog and "What's New" content management for Toot Scheduler. Use this skill whenever
  adding a new release entry, updating version numbers, or writing feature descriptions for
  the What's New modal. Trigger when the user asks to "add a release", "bump the version",
  "document what's new", "add a changelog entry", or "update the What's New modal".
  This skill ensures every release entry is consistent, well-written, and correctly wired
  into the features store and package.json.
---

# Changelog & "What's New" Management — Toot Scheduler

The "What's New" modal surfaces release notes to users directly inside the app.
All content is defined in TypeScript — there is no external JSON or markdown changelog file.
This skill covers everything needed to publish a new version entry.

---

## Architecture overview

| File | Role |
|------|------|
| `src/types/features.ts` | TypeScript interfaces (`Feature`, `FeatureGroup`, `UserFeatureState`) |
| `src/stores/features.ts` | Pinia store — holds the full ordered list of `FeatureGroup[]` |
| `src/components/Modals/WhatsNew.vue` | Renders the modal content (read-only — no edits needed for a release) |
| `package.json` | Authoritative version number — must stay in sync with the latest `FeatureGroup.version` |

---

## Data model

```typescript
// src/types/features.ts

export interface Feature {
  id: string;          // kebab-case, unique across ALL versions — never reuse
  title: string;       // Short label shown as heading — start with a relevant emoji
  description: string; // 1–3 sentences, user-friendly, active voice, present tense
}

export interface FeatureGroup {
  version: string;     // Semantic version string — MUST match package.json "version"
  date: string;        // ISO 8601 date: YYYY-MM-DD
  features: Feature[]; // At least one Feature per FeatureGroup
}
```

---

## Versioning rules

This project uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

| Change type | Bump | Example |
|-------------|------|---------|
| Breaking change or full redesign | MAJOR | `1.0.0 → 2.0.0` |
| New user-visible feature | MINOR | `0.12.19 → 0.13.0` |
| Bug fix, performance fix, small improvement | PATCH | `0.12.19 → 0.12.20` |

> ⚠️ The `APP_VERSION` constant in `src/types/features.ts` is currently unused.
> The authoritative version comes from `features[0].version` in the store.
> Always keep `package.json` and the store's first entry in sync.

---

## Step-by-step: adding a new release entry

### 1. Decide the new version number

Read `package.json` → `"version"` field and the first entry in `features.ts` to confirm
the current version, then apply the semver rules above.

### 2. Write the feature entries

For each change to document, prepare a `Feature` object:

```typescript
{
  id: 'short-kebab-case-description',   // ✅ unique, descriptive
  title: '🎉 Feature name',             // ✅ emoji + title case, ≤ 60 chars
  description: 'What changed and why it helps the user. Keep it friendly and concise.'
}
```

#### Title guidelines
- Lead with a single relevant emoji
- Use title case after the emoji
- Prefer verbs for new features: "Add poll support", "Upload media images"
- Prefix bug fixes with `🐛 Fix:` — e.g., `🐛 Fix: wrong import URL`
- Prefix performance/UI fixes with `💄` or `⚡`

#### Description guidelines
- Write for a non-technical user
- Active voice, present tense: "You can now…", "Fixed an issue where…"
- 1–3 sentences maximum
- Can include a light, friendly tone (see existing entries for style reference)
- No markdown, no HTML — plain text only

#### ID rules
- kebab-case only, lowercase
- Must be unique across the **entire** `features` array (check existing IDs before adding)
- Descriptive: `upload-media-image` ✅ — `feature-1` ❌

### 3. Prepend the new FeatureGroup to the store

Open `src/stores/features.ts` and insert the new group **at the very top** of the
`features` array (index 0). The modal always reads from newest to oldest.

```typescript
// src/stores/features.ts — add at the TOP of the array

{
  version: '0.13.0',
  date: '2026-03-25',          // Today's date in YYYY-MM-DD
  features: [
    {
      id: 'my-new-feature',
      title: '✨ My New Feature',
      description: 'You can now do something amazing with Toot Scheduler!'
    },
  ],
},
```

### 4. Bump `package.json`

Update the `"version"` field to match the new `FeatureGroup.version`:

```json
{
  "version": "0.13.0"
}
```

> These two values must always be identical. If they drift, the modal may show incorrect
> version labels and the `latestVersion` computed property will be inaccurate.

---

## How the modal decides what to show

The store exposes `lastThreeNewFeatures` — the first 3 `FeatureGroup` entries whose
`version` string is NOT in the user's `seenFeatures` localStorage array.

This means:
- A new release is automatically surfaced to all users on next app load
- The orange "What's New" button in the header appears whenever `newFeatures.length > 0`
- Clicking "Got it!" calls `markFeaturesAsSeen()`, which writes all current versions to localStorage

You do **not** need to modify `WhatsNew.vue` or `App.vue` for a standard release entry.

---

## Release checklist

Before committing a new version:

- [ ] New `FeatureGroup` is at index `[0]` of the `features` array in `src/stores/features.ts`
- [ ] `version` string follows semver and is incremented from the previous entry
- [ ] `date` is today's date in `YYYY-MM-DD` format
- [ ] Every `Feature.id` is unique across the entire array
- [ ] Every `Feature.title` starts with an emoji and is ≤ 60 characters
- [ ] Every `Feature.description` is plain text, ≤ 3 sentences, user-friendly
- [ ] `package.json` `"version"` matches the new `FeatureGroup.version`
- [ ] No existing `FeatureGroup` entries were modified (changelog is append-only)

---

## What NOT to do

- ❌ Edit or delete existing `FeatureGroup` entries — the changelog is **append-only**
- ❌ Add a new group anywhere other than index `[0]` — order must be newest-first
- ❌ Use duplicate `Feature.id` values — the `v-for :key` binding depends on uniqueness
- ❌ Use markdown or HTML in `title` or `description` — they are rendered as plain text
- ❌ Set `version` in the store without updating `package.json`, or vice versa
- ❌ Add more than ~5 features per `FeatureGroup` — keep each release focused and readable
