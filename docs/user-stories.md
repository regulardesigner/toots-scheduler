# User Stories — Toot Scheduler

**Version:** 1.0
**Date:** 2026-03-25
**Status:** Implemented — derived from existing codebase

All stories below reflect features currently shipped in the application.
Status column uses: ✅ Done | 🚧 Partial | ⚠️ Known gap

---

## Epics

| Epic | Description |
|------|-------------|
| [EP-01](#ep-01--onboarding--discovery) | Onboarding & Discovery |
| [EP-02](#ep-02--authentication) | Authentication |
| [EP-03](#ep-03--toot-composition) | Toot Composition |
| [EP-04](#ep-04--content-moderation-tools) | Content Moderation Tools |
| [EP-05](#ep-05--media-attachments) | Media Attachments |
| [EP-06](#ep-06--polls) | Polls |
| [EP-07](#ep-07--scheduling) | Scheduling |
| [EP-08](#ep-08--scheduled-toots-management) | Scheduled Toots Management |
| [EP-09](#ep-09--session--security) | Session & Security |

---

## EP-01 — Onboarding & Discovery

---

### US-01 · Understand the product before signing in

**As a** visitor who has never used Toot Scheduler,
**I want to** understand what the service does and how it works,
**so that** I can decide whether to connect my Mastodon account.

**Acceptance criteria:**
- [ ] The landing page clearly states the product's purpose in the hero section
- [ ] A 3-step explanation describes the flow: sign in → write → relax
- [ ] A FAQ section answers the most common questions (free? secure? how it works?)
- [ ] No login is required to read the landing page

**Status:** ✅ Done

---

### US-02 · Start the login flow from the landing page

**As a** visitor ready to use the service,
**I want to** click a single call-to-action button to begin connecting my account,
**so that** I can get started without navigating away from the page.

**Acceptance criteria:**
- [ ] A "Get started" button is prominently displayed on the landing page
- [ ] Clicking it opens a login modal without navigating to a new page
- [ ] The modal can be dismissed without completing login

**Status:** ✅ Done

---

## EP-02 — Authentication

---

### US-03 · Connect my Mastodon account

**As a** Mastodon user,
**I want to** sign in using my instance URL,
**so that** Toot Scheduler can schedule toots on my behalf.

**Acceptance criteria:**
- [ ] There is a text field to enter my Mastodon instance URL (e.g. `https://mastodon.social`)
- [ ] The field only accepts valid URLs starting with `https://` or `http://`
- [ ] Submitting the form registers the app with my instance and redirects me to Mastodon's authorization page
- [ ] After I grant access on Mastodon, I am automatically redirected back to the composer

**Status:** ✅ Done

---

### US-04 · See a meaningful error if my instance URL is invalid

**As a** user trying to connect,
**I want to** receive a clear error message if my instance URL is wrong or unreachable,
**so that** I know what to fix and can try again.

**Acceptance criteria:**
- [ ] An error message is displayed inline in the login form (not in a separate page)
- [ ] The error message does not expose technical details (stack traces, internal paths)
- [ ] The form remains usable after an error — I can correct the URL and retry

**Status:** ✅ Done

---

### US-05 · Stay signed in across browser sessions

**As a** returning user,
**I want to** remain authenticated when I reopen the browser,
**so that** I don't have to reconnect every time I visit.

**Acceptance criteria:**
- [ ] My access token persists in `localStorage` between sessions
- [ ] On return, the app validates my stored token against the instance before restoring the session
- [ ] If the token is expired or revoked, I am silently logged out and shown the landing page — not an error screen

**Status:** ✅ Done

---

### US-06 · Be redirected to the composer automatically if already authenticated

**As a** returning authenticated user,
**I want to** be taken directly to the composer when I open the app,
**so that** I don't have to navigate past the landing page manually.

**Acceptance criteria:**
- [ ] Accessing `/` while authenticated immediately redirects to `/composer`
- [ ] Accessing `/composer` without a token redirects to `/`

**Status:** ✅ Done

---

### US-07 · Log out and disconnect my account

**As an** authenticated user,
**I want to** log out of Toot Scheduler,
**so that** my credentials are no longer stored in this browser.

**Acceptance criteria:**
- [ ] A logout action is available from the authenticated view
- [ ] Logging out clears the access token, client credentials, and instance URL from storage
- [ ] I am redirected to the landing page after logout

**Status:** ✅ Done

---

## EP-03 — Toot Composition

---

### US-08 · See my account identity in the composer

**As an** authenticated user,
**I want to** see my avatar, display name, and handle at the top of the composer,
**so that** I know which account I am composing for.

**Acceptance criteria:**
- [ ] My avatar, display name, and `@handle` are displayed
- [ ] The count of currently scheduled toots is visible

**Status:** ✅ Done

---

### US-09 · Write and submit a toot

**As an** authenticated user,
**I want to** type my toot content and schedule it,
**so that** it gets posted automatically at the time I choose.

**Acceptance criteria:**
- [ ] There is a textarea for the toot content
- [ ] The toot is required — an empty toot cannot be submitted
- [ ] After successful scheduling, the form resets to an empty state
- [ ] Errors during submission are shown inline

**Status:** ✅ Done

---

### US-10 · Know how many characters I have left

**As a** user composing a toot,
**I want to** see a real-time character count,
**so that** I can stay within Mastodon's 500-character limit.

**Acceptance criteria:**
- [ ] The remaining character count updates as I type
- [ ] The counter turns red when fewer than 50 characters remain
- [ ] The textarea enforces the 500-character maximum — I cannot type beyond it

**Status:** ✅ Done

---

### US-11 · Edit a scheduled toot before it is published

**As a** user who has already scheduled a toot,
**I want to** be able to edit its content, date, or settings,
**so that** I can correct mistakes or update information without deleting and recreating it manually.

**Acceptance criteria:**
- [ ] Clicking "Edit" on a toot card pre-fills the composer with all existing values (text, date, time, visibility, language, content warning, media, poll)
- [ ] The submit button reads "Update" instead of "Schedule"
- [ ] A "Cancel" button is visible and discards the edit without saving
- [ ] Saving the edit deletes the original toot and creates a new one (Mastodon API limitation — this is acceptable)
- [ ] After updating, the composer resets and the list refreshes

**Status:** ✅ Done

---

## EP-04 — Content Moderation Tools

---

### US-12 · Add a content warning to a toot

**As a** user posting potentially sensitive content,
**I want to** add a content warning with a summary text,
**so that** other Mastodon users can choose whether to read the full content.

**Acceptance criteria:**
- [ ] There is a "Add content warning" toggle above the text area
- [ ] Enabling it reveals a text field where I can write the warning message
- [ ] Both the `sensitive` flag and the warning text are sent to the Mastodon API on submission
- [ ] The content warning can be removed by unchecking the toggle

**Status:** ✅ Done

---

### US-13 · Preview a content-warned toot in the scheduled list

**As a** user reviewing my scheduled toots,
**I want to** see the content warning label and keep the toot body hidden by default,
**so that** the list is safe to view in shared environments.

**Acceptance criteria:**
- [ ] Toot cards with a content warning display the spoiler text prominently
- [ ] The toot body is blurred behind the warning by default
- [ ] A toggle (eye icon) lets me reveal or hide the full content
- [ ] The toggle state does not affect other toot cards

**Status:** ✅ Done

---

## EP-05 — Media Attachments

---

### US-14 · Attach images or media to a scheduled toot

**As a** user composing a toot,
**I want to** attach media files to it,
**so that** the scheduled toot includes my photos, video, or audio.

**Acceptance criteria:**
- [ ] A media upload section can be toggled from the composer toolbar
- [ ] Files are uploaded to my Mastodon instance immediately upon selection
- [ ] Upload progress is shown while the file is being sent
- [ ] Up to 4 media attachments can be added per toot
- [ ] I can remove individual attachments before submitting
- [ ] The media toggle is disabled while a poll is active (mutually exclusive)

**Status:** ✅ Done

---

### US-15 · See existing media when editing a scheduled toot

**As a** user editing a toot that has media,
**I want to** see the existing attachments pre-loaded in the editor,
**so that** I can keep, replace, or remove them as needed.

**Acceptance criteria:**
- [ ] When editing, existing media attachments are displayed in the media section
- [ ] The media section automatically opens if the original toot had attachments

**Status:** ✅ Done

---

## EP-06 — Polls

---

### US-16 · Add a poll to a scheduled toot

**As a** user wanting to engage my followers,
**I want to** attach a poll to my scheduled toot,
**so that** my audience can vote when the toot is published.

**Acceptance criteria:**
- [ ] A poll section can be toggled from the composer toolbar
- [ ] The poll has 2 options by default with a minimum of 2 and a maximum of 4
- [ ] I can add options (up to 4) and remove them (only when more than 2 remain)
- [ ] I can set a poll duration from a predefined list: 5 min, 1h, 6h, 12h, 1 day, 3 days, 7 days
- [ ] I can enable "Allow multiple votes"
- [ ] I can enable "Hide totals until poll ends"
- [ ] The poll toggle is disabled while media is attached (mutually exclusive)

**Status:** ✅ Done

---

### US-17 · See poll details when editing a scheduled toot

**As a** user editing a toot that has a poll,
**I want to** see the existing poll options and settings pre-loaded,
**so that** I can update them as needed.

**Acceptance criteria:**
- [ ] When editing, poll options, duration, and settings are restored in the poll section
- [ ] The poll section automatically opens if the original toot had a poll

**Status:** ✅ Done

---

## EP-07 — Scheduling

---

### US-18 · Set a date and time for my toot to be published

**As a** user composing a toot,
**I want to** pick an exact date and time for publication,
**so that** my toot goes out at the right moment without me being online.

**Acceptance criteria:**
- [ ] There are separate date and time pickers
- [ ] The date picker's minimum value is today (past dates are not selectable)
- [ ] The scheduled time must be at least 5 minutes in the future — an earlier time shows an error and blocks submission

**Status:** ✅ Done

---

### US-19 · Choose the visibility of my scheduled toot

**As a** user composing a toot,
**I want to** control who can see it,
**so that** it reaches the right audience when published.

**Acceptance criteria:**
- [ ] A visibility selector offers: Public, Unlisted, Followers only, Direct message
- [ ] The default is Public
- [ ] The selected visibility is sent to the Mastodon API on submission

**Status:** ✅ Done

---

### US-20 · Set the language of my scheduled toot

**As a** multilingual user,
**I want to** specify the language of my toot,
**so that** Mastodon can correctly classify and surface it for relevant audiences.

**Acceptance criteria:**
- [ ] A language selector offers 14 languages (English, French, German, Spanish, Italian, Portuguese, Russian, Japanese, Chinese, Korean, Dutch, Polish, Arabic, Hindi)
- [ ] The default is English
- [ ] The selected language is sent to the Mastodon API on submission

**Status:** ✅ Done

---

## EP-08 — Scheduled Toots Management

---

### US-21 · See all my scheduled toots in one place

**As an** authenticated user,
**I want to** view the full list of my pending scheduled toots,
**so that** I can get an overview of my upcoming posts.

**Acceptance criteria:**
- [ ] A collapsible section below the composer lists all scheduled toots
- [ ] The list auto-expands when at least one toot is pending
- [ ] Toots are sorted chronologically by scheduled date (ascending)
- [ ] Each card shows: scheduled date/time, toot text, visibility, language, and indicators for media and polls

**Status:** ✅ Done

---

### US-22 · See a clear state when I have no scheduled toots

**As a** user with no pending toots,
**I want to** see an empty state message rather than a blank section,
**so that** I know the list is working and simply empty.

**Acceptance criteria:**
- [ ] When no toots exist, the message "No scheduled toots yet." is displayed
- [ ] The section header still shows the count (0)

**Status:** ✅ Done

---

### US-23 · Delete a scheduled toot I no longer need

**As a** user who has changed their mind about a post,
**I want to** delete a scheduled toot before it is published,
**so that** it does not post automatically.

**Acceptance criteria:**
- [ ] Each toot card has a "Delete" button
- [ ] Clicking "Delete" opens an in-app modal — not a browser `window.confirm()` dialog
- [ ] The modal displays the beginning of the toot text so I can confirm I'm deleting the right one
- [ ] The modal has a clearly labelled "Cancel" button and a visually distinct "Delete" button
- [ ] Pressing Escape or clicking the overlay closes the modal without deleting
- [ ] After confirmed deletion, the list refreshes to reflect the change
- [ ] Errors during deletion are shown in the list, not as a page crash
- [ ] The modal is accessible: focus is trapped inside while open and returns to the triggering element on close

**Status:** ✅ Done

---

### US-24 · See loading and error states during list operations

**As a** user waiting for the app to communicate with my instance,
**I want to** see clear feedback when data is loading or when something goes wrong,
**so that** I know whether to wait or take action.

**Acceptance criteria:**
- [ ] A loading indicator is shown while the list is being fetched or updated
- [ ] An error message is shown if the API request fails
- [ ] Both states are visually distinct from the empty state

**Status:** ✅ Done

---

### US-25 · See scheduled toots animate when the list changes

**As a** user managing my scheduled toots,
**I want to** see smooth transitions when items are added or removed,
**so that** the interface feels polished and responsive.

**Acceptance criteria:**
- [ ] Toot cards slide and fade in when added to the list
- [ ] Toot cards animate out when deleted

**Status:** ✅ Done

---

## EP-09 — Session & Security

---

### US-26 · Be warned before my session expires

**As an** authenticated user working on my toots,
**I want to** receive a warning before I am automatically logged out,
**so that** I have time to save my work or extend the session.

**Acceptance criteria:**
- [ ] A notification appears 5 minutes before the 30-minute inactivity timeout
- [ ] The notification clearly states how much time remains
- [ ] I can click the notification to extend the session for another 30 minutes

**Status:** ✅ Done

---

### US-27 · Be automatically logged out after inactivity

**As a** user who has left the app unattended,
**I want to** be automatically logged out after a period of inactivity,
**so that** my Mastodon account is protected if I forget to close the browser.

**Acceptance criteria:**
- [ ] The session expires after 30 minutes with no mouse movement, click, or keypress
- [ ] Upon expiry, I am logged out and redirected to the landing page
- [ ] An informational message confirms that I was logged out due to inactivity
- [ ] Any user activity (mouse, keyboard, click) resets the timer

**Status:** ✅ Done

---

### US-28 · Have my token validated before restoring a session

**As a** returning user,
**I want to** have my stored credentials automatically verified,
**so that** I am not unexpectedly stuck in a broken authenticated state with an invalid token.

**Acceptance criteria:**
- [ ] On startup, the stored token is checked against the instance with a live API call
- [ ] If the check fails (expired, revoked, instance unreachable), credentials are cleared silently
- [ ] No error screen is shown — I simply land on the landing page ready to reconnect

**Status:** ✅ Done

---

## Known Gaps

These are security and UX improvements identified during the BRD analysis that do not yet have corresponding user stories because the features are not yet implemented.

| ID | Description | Linked concern |
|----|-------------|----------------|
| GAP-01 | OAuth `state` parameter not implemented | CSRF protection during authorization — see `web-security` skill |
| GAP-02 | Token stored in `localStorage` instead of `sessionStorage` | Wider XSS exposure surface — see `web-security` skill |
| GAP-03 | No Content Security Policy defined | Missing browser-level XSS mitigation — see `web-security` skill |
| GAP-04 | No client-side file type / size validation before media upload | UX degradation + unnecessary API errors |
| GAP-05 | HTTP instance URLs not explicitly warned against | Tokens sent in plaintext over unencrypted connections |
