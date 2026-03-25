# Business Requirements Document — Toot Scheduler

**Version:** 1.0
**Date:** 2026-03-25
**Status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Goals](#2-business-goals)
3. [Target Users](#3-target-users)
4. [Application Navigation & Routes](#4-application-navigation--routes)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [Landing Page](#51-landing-page)
   - 5.2 [Authentication](#52-authentication)
   - 5.3 [Toot Composer](#53-toot-composer)
   - 5.4 [Content Warning](#54-content-warning)
   - 5.5 [Media Attachments](#55-media-attachments)
   - 5.6 [Polls](#56-polls)
   - 5.7 [Scheduling Controls](#57-scheduling-controls)
   - 5.8 [Scheduled Toots Management](#58-scheduled-toots-management)
   - 5.9 [Session Management](#59-session-management)
6. [Data Models](#6-data-models)
7. [Technical Architecture](#7-technical-architecture)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Constraints & Known Limitations](#9-constraints--known-limitations)
10. [Out of Scope](#10-out-of-scope)

---

## 1. Project Overview

**Toot Scheduler** is a free, open-source browser application that allows Mastodon users to compose and schedule posts (called "toots") for automatic publication at a future date and time.

The application is a pure Single-Page Application (SPA) with no backend. All data is stored on the user's own Mastodon instance. The application authenticates users via OAuth 2.0 and communicates exclusively with the user's chosen Mastodon instance.

**Live deployment:** GitHub Pages at `/toots-scheduler/`
**Repository:** [regulardesigner/toots-scheduler](https://github.com/regulardesigner/toots-scheduler)

---

## 2. Business Goals

| # | Goal | Success Indicator |
|---|------|------------------|
| G1 | Allow Mastodon users to schedule toots without needing a third-party service with a backend | User can schedule a toot that posts automatically |
| G2 | Be entirely free with no hidden costs | No paywall, no account required beyond a Mastodon instance |
| G3 | Store no user data outside the user's own Mastodon instance | Zero server-side data persistence |
| G4 | Be accessible to any Mastodon user regardless of their instance | Works with any standard Mastodon-compatible instance URL |
| G5 | Provide a simple, low-friction user experience | Scheduling a toot requires 3 steps: sign in, write, schedule |

---

## 3. Target Users

**Primary user:** Any person with an active Mastodon account who wants to plan their posts in advance — content creators, journalists, community managers, or casual users who want to post at a specific time without being online.

**Prerequisites:**
- A Mastodon account on any public or private instance
- A modern desktop or mobile browser
- Knowledge of their instance URL (e.g. `https://mastodon.social`)

---

## 4. Application Navigation & Routes

The application has three routes, managed by Vue Router with a navigation guard that enforces authentication state.

| Route | Name | Component | Auth Required | Description |
|-------|------|-----------|---------------|-------------|
| `/` | `home` | `LandingPage` | No | Public landing page with login entry point |
| `/composer` | `composer` | `TootComposer` | **Yes** | Main application view for composing and managing scheduled toots |
| `/oauth/callback` | `oauth-callback` | `OAuthCallback` | No | Handles the OAuth 2.0 authorization code exchange |
| `/*` (catch-all) | — | — | No | Redirects all unknown paths to `/` |

**Navigation guard behaviour:**
- An unauthenticated user accessing `/composer` is redirected to `/`.
- An authenticated user accessing `/` is automatically redirected to `/composer`.

---

## 5. Functional Requirements

### 5.1 Landing Page

**Purpose:** Entry point for unauthenticated users. Explains the product and initiates login.

**Requirements:**

| ID | Requirement |
|----|-------------|
| LP-01 | Display a hero section with the product name and a "Get started" call-to-action button |
| LP-02 | Display a 3-step explanation of how the service works |
| LP-03 | Display a FAQ section with 5 pre-written questions and collapsible answers |
| LP-04 | Clicking "Get started" opens the Login Form inside a modal overlay |
| LP-05 | The modal can be closed without completing login |
| LP-06 | The page is fully responsive on mobile (breakpoint: 768px) |

---

### 5.2 Authentication

**Purpose:** Securely authenticate the user against their Mastodon instance via OAuth 2.0 Authorization Code flow.

**Requirements:**

| ID | Requirement |
|----|-------------|
| AU-01 | The user enters their Mastodon instance URL in a form field (type `url`, HTTPS pattern enforced) |
| AU-02 | The application normalizes the URL (strips path, query, fragment — retains only the origin) |
| AU-03 | The application registers itself as an OAuth client on the instance (`POST /api/v1/apps`) |
| AU-04 | The application stores `client_id` and `client_secret` in `localStorage` |
| AU-05 | The user is redirected to the Mastodon OAuth authorization page with scopes: `read:accounts read:statuses write:media write:statuses` |
| AU-06 | After the user grants access, Mastodon redirects to `/oauth/callback` with an authorization code |
| AU-07 | The callback exchanges the code for an access token (`POST /oauth/token`) |
| AU-08 | The access token is stored in `localStorage` |
| AU-09 | The authenticated user's account information is fetched (`GET /api/v1/accounts/verify_credentials`) and stored in application state |
| AU-10 | The user is redirected to `/composer` after successful authentication |
| AU-11 | On application startup, if a stored token exists, it is validated against the instance before restoring the session |
| AU-12 | If the stored token is invalid or expired, credentials are cleared silently and the user remains on the landing page |
| AU-13 | The user can log out from any authenticated view; logout clears all stored credentials and redirects to `/` |
| AU-14 | Login errors (invalid URL, unreachable instance) are displayed inline in the login form |

**OAuth scopes requested:**

| Scope | Purpose |
|-------|---------|
| `read:accounts` | Fetch the authenticated user's profile |
| `read:statuses` | Read scheduled statuses |
| `write:statuses` | Create and manage scheduled statuses |
| `write:media` | Upload media attachments |

---

### 5.3 Toot Composer

**Purpose:** The primary interface for composing a new toot or editing an existing scheduled toot.

**Requirements:**

| ID | Requirement |
|----|-------------|
| TC-01 | Display the authenticated user's avatar, display name, and handle at the top of the composer |
| TC-02 | Display the count of currently scheduled toots next to the user info |
| TC-03 | Provide a textarea for toot content with a 500-character maximum (enforced via `maxlength`) |
| TC-04 | Display a real-time character count showing remaining characters |
| TC-05 | Highlight the character count in red when fewer than 50 characters remain |
| TC-06 | Provide toggle controls to add a media section or a poll section (mutually exclusive) |
| TC-07 | On successful submission, reset the form to its default empty state |
| TC-08 | Display inline error messages if submission fails |
| TC-09 | When editing a scheduled toot, pre-populate all fields with the existing toot's data |
| TC-10 | In edit mode, display "Update" instead of "Schedule" on the submit button |
| TC-11 | In edit mode, display a "Cancel" button that discards the edit and resets the form |
| TC-12 | Updating a toot deletes the original and creates a new scheduled toot (Mastodon API limitation) |

---

### 5.4 Content Warning

**Purpose:** Allow the user to add a content warning (spoiler text) to a toot, which hides the content behind a warning label on Mastodon.

**Requirements:**

| ID | Requirement |
|----|-------------|
| CW-01 | Display a checkbox labelled "Add content warning" above the text area |
| CW-02 | When checked, reveal a text input for the warning message |
| CW-03 | The warning text input is hidden (not just disabled) when the checkbox is unchecked |
| CW-04 | The `sensitive` flag and `spoiler_text` are included in the toot submission payload when active |
| CW-05 | In the scheduled toots list, a toot with a content warning displays the spoiler text and blurs the toot content behind a toggle |

---

### 5.5 Media Attachments

**Purpose:** Allow the user to attach images, videos, or audio files to a scheduled toot.

**Requirements:**

| ID | Requirement |
|----|-------------|
| MA-01 | The media section is toggled via a checkbox in the content area toolbar |
| MA-02 | Media and poll sections are mutually exclusive — enabling one disables the other |
| MA-03 | Files are uploaded to the Mastodon instance via `POST /api/v2/media` before the toot is scheduled |
| MA-04 | Upload progress is displayed to the user |
| MA-05 | A maximum of 4 media attachments per toot is enforced (Mastodon API limit) |
| MA-06 | The user can remove individual media attachments before submission |
| MA-07 | Media attachment IDs are included in the toot submission payload |
| MA-08 | When editing a toot with existing media, the existing attachments are displayed and can be managed |

---

### 5.6 Polls

**Purpose:** Allow the user to attach a poll to a scheduled toot.

**Requirements:**

| ID | Requirement |
|----|-------------|
| PL-01 | The poll section is toggled via a checkbox in the content area toolbar |
| PL-02 | Poll and media sections are mutually exclusive — enabling one disables the other |
| PL-03 | A poll has a minimum of 2 options and a maximum of 4 options |
| PL-04 | The user can add options up to the 4-option limit via an "Add Option" button |
| PL-05 | The user can remove an option (only available when more than 2 options exist) |
| PL-06 | Poll duration is selectable from a predefined list: 5 minutes, 1 hour, 6 hours, 12 hours, 1 day, 3 days, 7 days |
| PL-07 | The default poll duration is 1 day (86 400 seconds) |
| PL-08 | The user can enable "Allow multiple votes" |
| PL-09 | The user can enable "Hide totals until poll ends" |
| PL-10 | The poll configuration is included in the toot submission payload |

---

### 5.7 Scheduling Controls

**Purpose:** Define the publication date, time, visibility, and language of the scheduled toot.

**Requirements:**

| ID | Requirement |
|----|-------------|
| SC-01 | The user selects a publication date via a date picker |
| SC-02 | The user selects a publication time via a time picker |
| SC-03 | The minimum allowed scheduling time is 5 minutes in the future (enforced client-side; required by Mastodon API) |
| SC-04 | The date picker's minimum selectable date is dynamically set to today |
| SC-05 | Attempting to schedule less than 5 minutes in the future displays an inline error and blocks submission |
| SC-06 | The user selects a visibility level from: Public, Unlisted, Followers only (private), Direct message |
| SC-07 | The default visibility is `public` |
| SC-08 | The user selects the toot language from a list of 14 supported languages |
| SC-09 | The default language is English (`en`) |

**Supported languages:**

| Code | Language |
|------|----------|
| `en` | English |
| `fr` | Français |
| `de` | Deutsch |
| `es` | Español |
| `it` | Italiano |
| `pt` | Português |
| `ru` | Русский |
| `ja` | 日本語 |
| `zh` | 中文 |
| `ko` | 한국어 |
| `nl` | Nederlands |
| `pl` | Polski |
| `ar` | العربية |
| `hi` | हिन्दी |

---

### 5.8 Scheduled Toots Management

**Purpose:** Display all scheduled toots for the authenticated account and allow the user to manage them.

**Requirements:**

| ID | Requirement |
|----|-------------|
| ST-01 | Display a collapsible list of all scheduled toots fetched from `GET /api/v1/scheduled_statuses` |
| ST-02 | The list auto-expands when at least one scheduled toot exists |
| ST-03 | Toots are sorted chronologically by scheduled date (ascending) |
| ST-04 | Each toot card displays: scheduled date/time, toot text, visibility, language |
| ST-05 | Each toot card indicates if it has media attachments (with count) or a poll |
| ST-06 | A toot with a content warning displays the spoiler text; the toot body is blurred by default and revealed by a toggle |
| ST-07 | Each toot card provides an "Edit" button that loads the toot into the composer in edit mode |
| ST-08 | Each toot card provides a "Delete" button with a confirmation dialog before deletion |
| ST-09 | The list refreshes after any create, update, or delete action |
| ST-10 | Loading and error states are displayed during API operations |
| ST-11 | An empty state message is shown when no scheduled toots exist |
| ST-12 | Toot cards animate in and out of the list (slide + fade transition) |

---

### 5.9 Session Management

**Purpose:** Protect the user's authenticated session and handle inactivity gracefully.

**Requirements:**

| ID | Requirement |
|----|-------------|
| SM-01 | An inactivity timer of 30 minutes is active during an authenticated session |
| SM-02 | User activity (mouse movement, click, keypress) resets the inactivity timer |
| SM-03 | A warning notification is shown 5 minutes before the session expires |
| SM-04 | The user can extend the session by clicking the warning notification |
| SM-05 | When the timer expires, the user is automatically logged out and redirected to `/` |
| SM-06 | The session timer is correctly cleaned up when the component is unmounted |

---

## 6. Data Models

These TypeScript interfaces define the data contracts between the application and the Mastodon API.

### `ScheduledToot` — toot creation payload

```ts
interface ScheduledToot {
  status: string;                                          // Toot text content (required)
  scheduled_at?: string;                                   // ISO 8601 datetime, ≥5 min in future
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive?: boolean;                                     // Triggers content warning
  spoiler_text?: string;                                   // Content warning text
  language?: string;                                       // ISO 639-1 code
  media_ids?: string[];                                    // IDs of uploaded media
  poll?: {
    options: string[];                                     // 2–4 options
    expires_in: number;                                    // Seconds
    multiple?: boolean;
    hide_totals?: boolean;
  };
}
```

### `MastodonStatus` — scheduled status response

```ts
interface MastodonStatus {
  id: string;
  content: string;
  created_at: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  url: string;
  media_attachments: MastodonMediaAttachment[];
  scheduled_at?: string;
  spoiler_text?: string;
  language?: string;
  poll?: { options: string[]; expires_in: number; multiple?: boolean; hide_totals?: boolean };
  params?: {                                               // Present on scheduled statuses
    text: string;
    media_ids?: string[];
    scheduled_at?: string;
    visibility?: string;
    sensitive?: boolean;
    spoiler_text?: string;
    language?: string;
    poll?: { options: string[]; expires_in: number; multiple?: boolean; hide_totals?: boolean };
  };
}
```

### `MastodonAccount` — authenticated user

```ts
interface MastodonAccount {
  id: string;
  username: string;
  acct: string;            // username@instance
  display_name: string;
  avatar: string;          // URL
}
```

### `MastodonMediaAttachment`

```ts
interface MastodonMediaAttachment {
  id: string;
  type: 'image' | 'video' | 'gifv' | 'audio';
  url: string;
  preview_url: string;
  description?: string;   // Alt text
}
```

---

## 7. Technical Architecture

### Tech stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Vue 3 (Composition API, `<script setup>`) | 3.x |
| Language | TypeScript | 5.x |
| Build tool | Vite | 5.x |
| State management | Pinia (setup store pattern) | 2.x |
| Routing | Vue Router | 4.x |
| HTTP client | Axios | 1.x |
| Date utilities | date-fns | 3.x |
| Fonts | Nunito Sans (body), Winky Sans (headings) | Variable fonts, self-hosted |
| Deployment | GitHub Pages | — |

### Project structure

```
src/
├── components/
│   ├── Auth/              # LoginForm.vue
│   ├── Toot/              # TootComposer, TootCard, ScheduledToots, PollSection
│   ├── Modals/            # ModalView, WhatsNew
│   ├── icons/             # SVG icon components
│   ├── ContentArea.vue    # Toot textarea + media/poll toggles
│   ├── ContentWarning.vue # Sensitive content toggle + spoiler text
│   ├── ControlsBar.vue    # Date, time, visibility, language inputs
│   ├── LandingPage.vue    # Public landing page
│   ├── MediaUpload.vue    # File upload UI
│   └── OAuthCallback.vue  # OAuth callback handler
├── composables/
│   ├── useMastodonApi.ts  # All Mastodon API calls
│   └── useSessionTimeout.ts
├── stores/
│   ├── auth.ts            # Authentication state + localStorage persistence
│   ├── scheduledToots.ts  # Scheduled toots state + CRUD actions
│   └── features.ts        # Feature flags
├── types/
│   └── mastodon.ts        # All TypeScript interfaces
├── utils/
│   ├── api.ts             # Axios client factory + auth interceptor
│   ├── error.ts           # API error normalizer
│   └── url.ts             # URL normalization
└── router/
    └── index.ts           # Routes + navigation guard
```

### API integration

All Mastodon API calls are encapsulated in `useMastodonApi.ts`. The HTTP client is configured with:
- A 10-second request timeout
- An auth interceptor that attaches `Authorization: Bearer <token>` only when the request URL matches `auth.instance` (prevents token leakage)

**Mastodon API endpoints used:**

| Action | Method | Endpoint |
|--------|--------|----------|
| Register OAuth app | POST | `/api/v1/apps` |
| Get access token | POST | `/oauth/token` |
| Verify credentials | GET | `/api/v1/accounts/verify_credentials` |
| Create / schedule toot | POST | `/api/v1/statuses` |
| List scheduled toots | GET | `/api/v1/scheduled_statuses` |
| Delete scheduled toot | DELETE | `/api/v1/scheduled_statuses/:id` |
| Upload media | POST | `/api/v2/media` |
| Update media metadata | PUT | `/api/v1/media/:id` |

---

## 8. Non-Functional Requirements

### Performance

| ID | Requirement |
|----|-------------|
| PF-01 | The application loads and is interactive within 3 seconds on a standard broadband connection |
| PF-02 | API requests have a timeout of 10 seconds |
| PF-03 | Media upload progress is communicated to the user in real time |

### Security

| ID | Requirement |
|----|-------------|
| SE-01 | OAuth tokens are never sent to any URL other than the user's registered Mastodon instance |
| SE-02 | User-supplied instance URLs are normalized before use, extracting only the `origin` |
| SE-03 | API-sourced content (toot text, display names) is rendered via safe interpolation only — never injected as raw HTML |
| SE-04 | Session expires after 30 minutes of inactivity |
| SE-05 | All npm dependencies are kept free of high/critical CVEs |

### Accessibility

| ID | Requirement |
|----|-------------|
| AC-01 | Interactive controls have `aria-label` attributes where visible labels are absent |
| AC-02 | Form inputs are associated with labels via `for`/`id` pairing |
| AC-03 | The application is usable with keyboard navigation |

### Browser compatibility

| ID | Requirement |
|----|-------------|
| BC-01 | The application supports the two most recent versions of Chrome, Firefox, and Safari |
| BC-02 | The application is responsive and usable on mobile viewports (min-width: 320px) |
| BC-03 | Both light and dark color schemes are supported via `prefers-color-scheme` |

---

## 9. Constraints & Known Limitations

| Constraint | Description |
|------------|-------------|
| No backend | The app has no server. All data is stored on the user's Mastodon instance. If the instance is unavailable, no scheduled toots can be managed. |
| Mastodon API only | The app is not compatible with other ActivityPub-based platforms (Misskey, Pleroma, etc.) that may have different API implementations. |
| Minimum scheduling delay | Mastodon requires a minimum of 5 minutes between now and the scheduled time. This is an API-level constraint that cannot be bypassed. |
| Content update requires delete + recreate | The Mastodon API's `PUT /api/v1/scheduled_statuses/:id` only allows changing the scheduled time, not the content. Updating content requires deleting the original and creating a new toot. |
| `client_secret` in browser storage | For a pure SPA without a backend, storing the OAuth `client_secret` in `localStorage` is unavoidable. This is a known trade-off; scope minimization compensates for it. |
| Max 300 scheduled toots | Mastodon instances typically enforce a limit of 300 pending scheduled statuses per account. |
| OAuth state parameter absent | The current OAuth flow does not implement a `state` parameter for CSRF protection. This is a known gap planned for a future improvement. |
| `localStorage` for token persistence | Tokens are stored in `localStorage` to persist across browser sessions. This makes them accessible to any JavaScript running on the page — an `sessionStorage` migration would reduce this risk. |

---

## 10. Out of Scope

The following capabilities are explicitly not part of the current version:

- Publishing toots immediately (without scheduling)
- Editing the content of an already-published toot
- Managing a posting queue or drafts
- Analytics or engagement tracking
- Push notifications
- Multi-account support
- Support for non-Mastodon ActivityPub platforms
- Backend, server-side storage, or user accounts on the Toot Scheduler service itself
- Recurring / repeating toots
- Image editing or cropping before upload
