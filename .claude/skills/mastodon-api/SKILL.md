---
name: mastodon-api
description: >
  Mastodon API reference and integration guide for the Toot Scheduler project. Use this skill
  whenever working with Mastodon API calls, OAuth authentication, scheduled statuses, media uploads,
  or any interaction with a Mastodon instance. Trigger when the user asks to add a new API feature,
  fix an API call, handle a new endpoint, or extend the OAuth flow. Always verify against the
  official Mastodon documentation before implementing anything API-related.
---

# Mastodon API — Toot Scheduler Reference

Before implementing or modifying any API interaction, **always verify against the official docs:**
👉 https://docs.joinmastodon.org/api/

---

## How API calls work in this project

All API requests go through `src/composables/useMastodonApi.ts`.
The HTTP client is `axios`, configured via `src/utils/api.ts` (`createApiClient()`).
The instance URL and access token come from the Pinia auth store (`useAuthStore`).

**Pattern for adding a new API call:**

```ts
async function myNewAction(param: string): Promise<ReturnType> {
  if (!auth.instance) throw new Error('No instance URL set');
  try {
    const response = await api.get(`${auth.instance}/api/v1/some-endpoint`);
    return response.data;
  } catch (error) {
    throw new Error(handleApiError(error));
  }
}
```

Add the function to the returned object with a JSDoc comment. Always guard with `if (!auth.instance)`.

---

## OAuth flow

**Scopes currently requested:**
```
read:accounts read:statuses write:media write:statuses
```

If a new feature needs additional scopes (e.g., `write:follows`), you must:
1. Add the scope to both `registerApplication()` and `getAccessToken()` in `useMastodonApi.ts`
2. Re-run the full OAuth flow (existing tokens won't have the new scope)
3. Verify the scope is documented at https://docs.joinmastodon.org/api/oauth-scopes/

**Redirect URI pattern:**
```ts
window.location.origin + import.meta.env.BASE_URL + 'oauth/callback'
```

---

## Endpoints used in this project

| Feature                  | Method | Endpoint                              | Docs link |
|--------------------------|--------|---------------------------------------|-----------|
| Register application     | POST   | `/api/v1/apps`                        | [→](https://docs.joinmastodon.org/methods/apps/) |
| Get access token         | POST   | `/oauth/token`                        | [→](https://docs.joinmastodon.org/methods/oauth/) |
| Verify credentials       | GET    | `/api/v1/accounts/verify_credentials` | [→](https://docs.joinmastodon.org/methods/accounts/) |
| Post / schedule status   | POST   | `/api/v1/statuses`                    | [→](https://docs.joinmastodon.org/methods/statuses/) |
| List scheduled statuses  | GET    | `/api/v1/scheduled_statuses`          | [→](https://docs.joinmastodon.org/methods/scheduled_statuses/) |
| Update scheduled status  | PUT    | `/api/v1/scheduled_statuses/:id`      | [→](https://docs.joinmastodon.org/methods/scheduled_statuses/) |
| Delete scheduled status  | DELETE | `/api/v1/scheduled_statuses/:id`      | [→](https://docs.joinmastodon.org/methods/scheduled_statuses/) |
| Upload media             | POST   | `/api/v2/media`                       | [→](https://docs.joinmastodon.org/methods/media/) |
| Update media metadata    | PUT    | `/api/v1/media/:id`                   | [→](https://docs.joinmastodon.org/methods/media/) |

---

## Scheduled statuses — key constraints

The Mastodon API has strict rules about scheduling. Always check these before implementing:

- `scheduled_at` must be **at least 5 minutes in the future** (enforced client-side too — see `MIN_SCHEDULE_AHEAD_MINUTES` in `TootComposer.vue`)
- Format: ISO 8601 string (use `.toISOString()`)
- Max scheduled statuses per account: typically 300 (instance-dependent)
- Scheduled statuses use **`/api/v1/statuses`** with `scheduled_at` in the payload — not a separate endpoint for creation
- For updates, use **`/api/v1/scheduled_statuses/:id`** (PUT) — this only allows changing `scheduled_at`, not the content

> ⚠️ If you need to update the **content** of a scheduled toot, you must delete and recreate it.
> See https://docs.joinmastodon.org/methods/scheduled_statuses/

---

## Status payload structure

```ts
{
  status: string,                          // Required. The text content.
  scheduled_at: string,                    // ISO 8601. Must be ≥5min in the future.
  visibility: 'public'|'unlisted'|'private'|'direct',
  sensitive: boolean,
  spoiler_text: string,                    // Content warning text
  language: string,                        // ISO 639 language code
  media_ids: string[],                     // IDs from /api/v2/media uploads
  poll?: {
    options: string[],                     // 2–4 options
    expires_in: number,                    // Seconds. Min: 300, max: 2629746
    multiple?: boolean,
    hide_totals?: boolean,
  },
  idempotency: string,                     // Use Date.now().toString() to prevent duplicates
}
```

---

## Media uploads

- Endpoint: `/api/v2/media` (NOT v1 — v1 is deprecated for large files)
- Use `XMLHttpRequest` with progress events (not axios) — see `uploadMedia()` in `useMastodonApi.ts`
- Set `Authorization: Bearer <token>` header manually on XHR
- After upload, use `PUT /api/v1/media/:id` to add `description` (alt text) and `focus` coordinates
- Supported types: image, video, gifv, audio

---

## Error handling

- Use `handleApiError` from `src/utils/error.ts` inside every `catch` block
- Mastodon returns errors as `{ error: string }` or `{ errors: [...] }` — the utility normalizes this
- Distinguish between 4xx (user errors) and 5xx (server errors) when surfacing messages

---

## TypeScript types

All Mastodon API types are defined in `src/types/mastodon.ts`:
- `MastodonStatus` — status/scheduled status response
- `MastodonAccount` — user account
- `MastodonMediaAttachment` — media response
- `ScheduledToot` — payload for creating/updating a scheduled toot

When adding support for a new endpoint, add the corresponding interface to `mastodon.ts` first.

---

## Before implementing anything new

1. Read the relevant endpoint docs at https://docs.joinmastodon.org/api/
2. For the full parameter reference, constraints, and error codes, read `references/endpoints.md`
3. Check if the required OAuth scope is already requested — if not, plan for the re-auth flow
4. Add/extend the TypeScript type in `mastodon.ts`
5. Add the function to `useMastodonApi.ts` following the existing pattern
6. Test against a real Mastodon instance (mastodon.social works for development)

## Reference files

- `references/endpoints.md` — Référence complète de tous les endpoints utilisés dans ce projet :
  paramètres détaillés, structure des réponses, codes d'erreur, limites et contraintes.
