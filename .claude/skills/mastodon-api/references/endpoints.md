# Mastodon API — Endpoints Reference

> Official documentation: https://docs.joinmastodon.org/api/
> Load this file when you need full details for a specific endpoint
> (parameters, responses, constraints) beyond what SKILL.md covers.

---

## Table of contents

1. [Apps — OAuth Registration](#1-apps--oauth-registration)
2. [OAuth — Tokens](#2-oauth--tokens)
3. [Accounts](#3-accounts)
4. [Statuses — Publishing a toot](#4-statuses--publishing-a-toot)
5. [Scheduled Statuses](#5-scheduled-statuses)
6. [Media Attachments](#6-media-attachments)
7. [Common error codes](#7-common-error-codes)
8. [Limits and constraints](#8-limits-and-constraints)

---

## 1. Apps — OAuth Registration

### `POST /api/v1/apps`

Registers a client application on the Mastodon instance. Call once per instance, then store `client_id` and `client_secret`.

**Parameters (JSON body or form-data):**

| Parameter      | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `client_name`  | string | ✅       | Display name of the app (e.g. `"Toot Scheduler"`) |
| `redirect_uris`| string | ✅       | OAuth callback URI. Can be `urn:ietf:wg:oauth:2.0:oob` for apps without a redirect |
| `scopes`       | string | ❌       | Space-separated scopes. Default: `read` |
| `website`      | string | ❌       | URL of the application's website |

**Response 200:**
```json
{
  "id": "563419",
  "name": "Toot Scheduler",
  "website": "https://...",
  "redirect_uri": "https://.../oauth/callback",
  "client_id": "TWhM-tNSuncnqe...",
  "client_secret": "ZEaFUFmF0umgBX..."
}
```

**Scopes used in this project:**
```
read:accounts  read:statuses  write:media  write:statuses
```

Potentially useful scopes if the project grows:
- `write:follows` — follow/unfollow accounts
- `write:bookmarks` — manage bookmarks
- `push` — push notifications

---

## 2. OAuth — Tokens

### Authorization URL (browser redirect)

```
GET {instance}/oauth/authorize
  ?client_id=...
  &scope=read:accounts+read:statuses+write:media+write:statuses
  &redirect_uri=...
  &response_type=code
```

### `POST /oauth/token`

Exchanges the authorization code for an access token.

**Parameters (JSON body):**

| Parameter       | Type   | Required | Description |
|-----------------|--------|----------|-------------|
| `grant_type`    | string | ✅       | Always `"authorization_code"` |
| `code`          | string | ✅       | Code received as query param in the callback |
| `client_id`     | string | ✅       | From the app registration |
| `client_secret` | string | ✅       | From the app registration |
| `redirect_uri`  | string | ✅       | Must match exactly the one used during registration |
| `scope`         | string | ❌       | Requested scopes (must be a subset of the app's scopes) |

**Response 200:**
```json
{
  "access_token": "ZA-Yj3aBD8U8Cm7...",
  "token_type": "Bearer",
  "scope": "read:accounts read:statuses write:media write:statuses",
  "created_at": 1573979017
}
```

**Note:** Tokens do not expire by default on Mastodon. To revoke, call `POST /oauth/revoke`.

---

## 3. Accounts

### `GET /api/v1/accounts/verify_credentials`

Verifies the token and returns the authenticated account. Used on startup to validate the session.

**Required header:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "id": "14715",
  "username": "username",
  "acct": "username@instance.social",
  "display_name": "Display Name",
  "avatar": "https://files.mastodon.social/...",
  "header": "https://files.mastodon.social/...",
  "followers_count": 42,
  "following_count": 10,
  "statuses_count": 150
}
```

---

## 4. Statuses — Publishing a toot

### `POST /api/v1/statuses`

Creates a new status. If `scheduled_at` is provided, the status is scheduled rather than published immediately.

**Required headers:**
- `Authorization: Bearer <token>`
- `Idempotency-Key: <unique-string>` — optional but recommended to prevent duplicates

**Parameters (JSON body):**

| Parameter       | Type     | Required | Constraints | Description |
|-----------------|----------|----------|-------------|-------------|
| `status`        | string   | ✅*      | Max 500 chars (instance-dependent) | Toot content. *Required unless `media_ids` is provided |
| `scheduled_at`  | datetime | ❌       | ≥ 5 min in the future | If provided → scheduled status |
| `visibility`    | string   | ❌       | `public`, `unlisted`, `private`, `direct` | Default: account preference |
| `sensitive`     | boolean  | ❌       |             | Hides media behind a warning |
| `spoiler_text`  | string   | ❌       | Max 500 chars | Content warning text |
| `language`      | string   | ❌       | ISO 639-1 (e.g. `"en"`) | Language of the toot |
| `media_ids`     | string[] | ❌       | Max 4 media | IDs of uploaded media attachments |
| `poll`          | object   | ❌       | Incompatible with `media_ids` | Attached poll |
| `in_reply_to_id`| string   | ❌       |             | ID of the status to reply to |

**Poll structure:**
```json
{
  "options": ["Option A", "Option B"],   // 2 to 4 options
  "expires_in": 86400,                   // seconds. Min: 300, Max: 2629746 (~1 month)
  "multiple": false,                     // allow multiple choices
  "hide_totals": false                   // hide results until expiration
}
```

**Response 200 (immediately published):**
```json
{
  "id": "103704874086360371",
  "created_at": "2020-01-01T...",
  "content": "<p>Hello world</p>",
  "visibility": "public",
  "url": "https://mastodon.social/@username/103704874086360371"
}
```

**Response 200 (scheduled):**
```json
{
  "id": "3221",
  "scheduled_at": "2020-01-01T12:00:00.000Z",
  "params": {
    "text": "Hello world",
    "visibility": "public"
  },
  "media_attachments": []
}
```

---

## 5. Scheduled Statuses

### `GET /api/v1/scheduled_statuses`

Lists all scheduled statuses for the authenticated account.

**Response 200:** Array of ScheduledStatus objects (see structure below).

**ScheduledStatus object:**
```json
{
  "id": "3221",
  "scheduled_at": "2020-01-01T12:00:00.000Z",
  "params": {
    "text": "The toot content",
    "visibility": "public",
    "sensitive": false,
    "spoiler_text": "",
    "media_ids": [],
    "language": "en",
    "poll": null
  },
  "media_attachments": [],
  "poll": null
}
```

---

### `PUT /api/v1/scheduled_statuses/:id`

Updates a scheduled status. ⚠️ **Only `scheduled_at` can be changed** — not the content.

| Parameter      | Type     | Required | Description |
|----------------|----------|----------|-------------|
| `scheduled_at` | datetime | ✅       | New date/time (≥ 5 min in the future) |

**Response 200:** The updated ScheduledStatus object.

> To update the **content** of a scheduled toot: `DELETE` it and recreate with `POST /api/v1/statuses`.

---

### `DELETE /api/v1/scheduled_statuses/:id`

Deletes a scheduled status.

**Response 200:** `{}` (empty object)

---

## 6. Media Attachments

### `POST /api/v2/media`

Uploads a media file. Use v2 (not v1) for large files (asynchronous processing).

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Parameters (form-data):**

| Parameter     | Type   | Required | Constraints | Description |
|---------------|--------|----------|-------------|-------------|
| `file`        | file   | ✅       | See instance limits | File to upload |
| `description` | string | ❌       | Max 1500 chars | Alt text for accessibility |
| `focus`       | string | ❌       | Format `"x,y"` (-1.0 to 1.0) | Focal point for cropping |

**Typical limits (instance-dependent):**
- Images: 10 MB
- Videos / GIF: 40 MB
- Accepted types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/quicktime`, `audio/mpeg`, `audio/ogg`

**Response 200 (immediate) or 202 (async processing):**
```json
{
  "id": "22348641",
  "type": "image",
  "url": "https://files.mastodon.social/media_attachments/...",
  "preview_url": "https://files.mastodon.social/media_attachments/.../small.png",
  "description": "Alt text here"
}
```

> If the response is 202, the media is still processing. Wait, then call `GET /api/v1/media/:id` to confirm `url` is not null before using the ID.

---

### `PUT /api/v1/media/:id`

Updates metadata for an already-uploaded media attachment.

**Parameters (JSON body):**

| Parameter     | Type   | Description |
|---------------|--------|-------------|
| `description` | string | Alt text |
| `focus`       | object | `{ "x": 0.0, "y": 0.5 }` — coordinates between -1.0 and 1.0 |

---

## 7. Common error codes

| Code | Meaning | Recommended action |
|------|---------|--------------------|
| 401  | Invalid or expired token | Force logout and re-auth |
| 403  | Missing scope | Check OAuth scopes, restart auth flow |
| 404  | Resource not found | ID no longer exists (deleted toot?) |
| 422  | Invalid parameters | Read the `error` field in the response |
| 429  | Rate limit reached | Wait and retry (check `X-RateLimit-Reset` header) |
| 503  | Instance unavailable | Inform the user, retry later |

**Mastodon error format:**
```json
{ "error": "Human-readable description of the error" }
```

---

## 8. Limits and constraints

| Constraint | Typical value | Notes |
|------------|---------------|-------|
| Toot length | 500 characters | Configurable per instance |
| Scheduled toots per account | 300 | Configurable per instance |
| Minimum scheduling delay | 5 minutes | Strict — API rejects anything below |
| Media per toot | 4 max | Incompatible with polls |
| Poll options | 2 to 4 | |
| Poll duration | 5 min – ~1 month | `expires_in` in seconds |
| Rate limit | ~300 req/5 min | Varies by endpoint and instance |
