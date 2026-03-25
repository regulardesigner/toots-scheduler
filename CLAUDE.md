# Toot Scheduler — Claude Project Instructions

This is a Vue 3 + TypeScript + Vite application for scheduling Mastodon posts.

## Project Skills

Five skills are available in `.claude/skills/`. Always read the relevant skill before starting any task:

| Task type | Skill to read |
|-----------|--------------|
| Creating or modifying Vue components, composables, stores, types | `.claude/skills/vue3-codegen/SKILL.md` |
| Building or styling any UI element (buttons, forms, cards, layouts) | `.claude/skills/ui-design-system/SKILL.md` |
| Working with the Mastodon API, OAuth, or any HTTP call | `.claude/skills/mastodon-api/SKILL.md` |
| Reviewing, auditing, or writing any code touching auth, input, storage, or external data | `.claude/skills/web-security/SKILL.md` |
| Adding a release entry, bumping the version, or writing "What's New" content | `.claude/skills/changelog/SKILL.md` |

For any coding task in this project, load the relevant skill(s) first. Most tasks will need both `vue3-codegen` and `ui-design-system` together. Any feature touching authentication or the Mastodon API must also load `web-security`. Any release or version bump must load `changelog`.

## Tech Stack

- Vue 3 with `<script setup lang="ts">` (Composition API only)
- TypeScript
- Vite
- Pinia (setup store pattern)
- Vue Router
- Axios for HTTP
- date-fns for dates

## Project Structure

```
src/
├── components/    # Vue SFCs (Auth/, Toot/, Modals/, icons/)
├── composables/   # use*.ts composables
├── stores/        # Pinia stores
├── types/         # TypeScript interfaces (mastodon.ts)
├── utils/         # Pure utility functions
└── router/        # Vue Router config
```
