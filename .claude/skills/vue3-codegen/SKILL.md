---
name: vue3-codegen
description: >
  Vue 3 code generation for the Toot Scheduler project. Use this skill whenever writing or modifying
  Vue components, composables, Pinia stores, TypeScript types, or any Vue-related code in this project.
  Trigger when the user asks to create a component, add a feature, fix a Vue bug, write a composable,
  extend a store, or refactor existing Vue code. This skill ensures all generated code follows Vue 3
  Composition API best practices and the conventions already in place in this codebase.
---

# Vue 3 Code Generation — Toot Scheduler

This project is a Vue 3 + TypeScript + Vite application for scheduling Mastodon posts.
Always generate code that feels native to this codebase — consistent with existing files in `src/`.

---

## Non-negotiable conventions

### Script block
- Always use `<script setup lang="ts">` — never Options API, never `<script>` without `setup`
- Import Vue primitives explicitly: `import { ref, computed, watch, onMounted } from 'vue'`
- Place constants (uppercase snake_case) at the very top of `<script setup>`, before imports

```vue
<script setup lang="ts">
// Constants first
const MAX_POLL_OPTIONS = 4;
const DEFAULT_VISIBILITY = 'public';

import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
```

### Props and emits
- Use `defineProps<{}>()` with TypeScript generics — never the object syntax
- Use `defineEmits<{}>()` with typed signatures for all events
- For two-way binding, follow the `v-model:propName` pattern with `update:propName` events

```ts
defineProps<{
  scheduledDate: string;
  visibility: ScheduledToot['visibility'];
  isEditing: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:scheduledDate', value: string): void;
  (e: 'cancel'): void;
}>();
```

### Refs and reactivity
- Use `ref()` for primitive values, `computed()` for derived state
- Never mutate props directly — always emit
- `watch()` with `{ immediate: true }` when you need to react on mount too

### Composables
- Place in `src/composables/` and name them `use<Feature>.ts`
- Always return an object (not individual values) for clarity
- Add JSDoc to every exported function — see `useMastodonApi.ts` as the reference

```ts
/**
 * Brief description of what this composable does.
 * @returns {Object} Descriptive return value
 */
export function useMyFeature() {
  // ...
  return { doThing, isLoading };
}
```

### Pinia stores
- Always use the **setup store** syntax (function body, not object), as in `src/stores/auth.ts`
- Define store with `defineStore('store-name', () => { ... })`
- Expose state as `ref()`, actions as functions, computed as `computed()`
- Persist to `localStorage` where appropriate (see `auth.ts` for the pattern)
- Add JSDoc comments to all state properties and actions in the returned object

### TypeScript types
- All domain types live in `src/types/mastodon.ts` — add new types there
- Use `interface` for object shapes, `type` for unions/aliases
- Never use `any` — if needed temporarily, add a comment explaining why
- Import types with `import type { ... }` for type-only imports

---

## File structure

```
src/
├── components/        # Vue SFCs — organized by feature subfolder when related
│   ├── Auth/          # Auth-specific components
│   ├── Toot/          # Toot-specific components
│   ├── Modals/        # Modal components
│   └── icons/         # SVG icon components
├── composables/       # use*.ts composables
├── stores/            # Pinia stores
├── types/             # TypeScript interfaces and types
├── utils/             # Pure utility functions (no Vue, no Pinia)
└── router/            # Vue Router config
```

Respect this structure when creating new files. If a component is specific to a feature,
create or use a subfolder.

---

## Template patterns

- Use `v-if` / `v-else` for conditional rendering (not `v-show` unless toggling is very frequent)
- Use `v-for` with `:key` always — prefer stable IDs over array indexes
- Prefer `@submit.prevent` on forms
- Handle inputs manually with `:value` + `@input` when dealing with typed emits (see `ControlsBar.vue`)

```vue
<input
  :value="scheduledDate"
  @input="emit('update:scheduledDate', ($event.target as HTMLInputElement).value)"
/>
```

---

## Error handling

- Wrap async calls in `try/catch` blocks
- Use the existing `handleApiError` utility from `src/utils/error.ts`
- Expose errors via a `ref<string>('error')` and display with `<p v-if="error" class="error">`
- Always `finally` to reset loading states

```ts
async function doSomething() {
  try {
    error.value = '';
    isLoading.value = true;
    // ...
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Something went wrong.';
  } finally {
    isLoading.value = false;
  }
}
```

---

## What to avoid

- ❌ Options API (`data()`, `methods:`, `computed:`)
- ❌ `defineProps` with object syntax
- ❌ Direct DOM manipulation — use `ref` bindings instead
- ❌ Unnamed or untyped emits
- ❌ Inline styles — use scoped CSS classes
- ❌ `any` without a comment
- ❌ Importing from `vue` without destructuring (`import Vue from 'vue'`)
