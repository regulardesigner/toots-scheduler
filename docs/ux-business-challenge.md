# UX & Business Challenge — Toot Scheduler

**Version:** 1.0
**Date:** 2026-03-25
**Based on:** `docs/business-requirements.md` + `docs/user-stories.md`
**Method:** Nielsen's 10 Usability Heuristics, WCAG 2.1, Jobs-to-be-Done, MoSCoW prioritization

Each finding includes a **severity** rating:
- 🔴 Critical — blocks users or undermines trust
- 🟠 High — significant friction, likely to cause abandonment
- 🟡 Medium — noticeable degradation to experience or business value
- 🟢 Low — polish and improvement opportunity

---

## Table of Contents

1. [UX Findings](#1-ux-findings)
2. [Business Findings](#2-business-findings)
3. [User Story Gaps](#3-user-story-gaps)
4. [Prioritised Recommendations](#4-prioritised-recommendations)

---

## 1. UX Findings

### 1.1 Destructive actions without recovery 🔴

**Heuristic violated:** Error prevention + User control and freedom

The "Delete" action uses `window.confirm()` — a native browser dialog — as the only safeguard. Once confirmed, the toot is gone permanently with no undo.

Separately, the **edit flow deletes the original toot before creating the new one** (`scheduledToots.ts` — `deleteScheduledToot` then `scheduleToot`). If the second API call fails, the toot is lost. There is no rollback.

**Challenges:**
- US-23 states a "confirmation dialog" as an acceptance criterion but does not specify it must be a custom, accessible modal — the current `window.confirm()` is not styleable, not accessible on all platforms, and blocked by some browsers in certain contexts.
- No user story covers "undo a delete" or "recover from a failed edit".
- The BRD documents the delete-then-recreate constraint (§9) but accepts it without a mitigation strategy.

**Recommendations:**
- Replace `window.confirm()` with a custom in-page confirmation modal (already have a `ModalView` component).
- For the edit flow, reverse the order of operations: create the new toot first, then delete the old one — only if creation succeeds.
- Consider a brief "Undo" toast for 5–10 seconds post-deletion.

---

### 1.2 No success feedback after scheduling 🟠

**Heuristic violated:** Visibility of system status

After successfully submitting a toot, the form silently resets to empty. There is no confirmation — no toast, no message, nothing. The user has no way to distinguish between "it worked" and "something went wrong and the form reset".

**Challenges:**
- TC-07 says "reset the form to its default empty state" — this is a technical outcome, not a user experience. The story has no acceptance criterion for communicating success.
- The app already uses `vue-toastification` for session warnings — it is immediately available for success notifications.

**Recommendations:**
- Add a success toast: "Your toot has been scheduled for [date at time]."
- Add a success toast for edits: "Toot updated."
- Update US-09 and US-11 to include a success feedback criterion.

---

### 1.3 No draft persistence 🟠

**Heuristic violated:** Error prevention + User control and freedom

If a user is composing a long toot and accidentally closes the tab, navigates away, or is logged out by the session timeout (US-27), their entire draft is lost. There is no auto-save, no draft storage, and no warning before navigating away.

**Challenges:**
- No user story addresses draft saving. The entire EP-03 epic treats composition as a stateless, single-session act.
- The BRD lists "drafts" as Out of Scope (§10) — but this likely conflates a "drafts inbox" feature with basic compose-state persistence, which are different problems.

**Recommendations:**
- Distinguish "draft management" (Out of Scope, correct) from "unsaved changes protection" (should be in scope).
- Save the current compose state to `sessionStorage` on every keystroke, clear it on successful submission.
- Show a "You have an unsaved draft" banner when returning to the composer.
- Add a beforeunload warning when leaving the composer with content.

---

### 1.4 Character counter format is ambiguous 🟡

**Heuristic violated:** Visibility of system status

The counter shows only the number of **remaining** characters (e.g. `432`). This is the Twitter convention, but without context it is unclear whether `432` means "432 left" or "432 typed". Users unfamiliar with the convention will be confused, especially when the number approaches zero.

**Challenges:**
- TC-04 and TC-05 specify the counter behaviour but not its format. "432" alone provides no inherent meaning.

**Recommendations:**
- Use the format `68 / 500` (typed / max) — it is universally understood.
- Keep the red highlight at < 50 remaining (TC-05) as a warning layer.

---

### 1.5 Date and time as separate fields is poor on mobile 🟡

**Heuristic violated:** Flexibility and efficiency of use + Consistency

The scheduling controls use two separate inputs — `type="date"` and `type="time"`. On mobile, each triggers a different native picker, requiring two separate interactions. `type="datetime-local"` is a single unified field that provides the same data with one interaction.

**Challenges:**
- SC-01 and SC-02 define them as separate fields. SC-03 calculates the minimum from their combination — this logic would need updating.
- The minimum datetime logic (`minDateTime` computed in `ControlsBar.vue`) already produces an ISO string; `datetime-local` uses the same format.

**Recommendations:**
- Replace the date + time pair with a single `datetime-local` input.
- Update SC-01 and SC-02 to reflect a unified control.
- This also simplifies the "at least 5 minutes in the future" validation (SC-03), which currently combines two separate values.

---

### 1.6 No visible label on media and poll toggles 🟠

**Heuristic violated:** Recognition rather than recall + Accessibility

The media and poll toggles in `ContentArea.vue` are icon-only checkboxes with `aria-label` attributes but no visible text label. Users who are not familiar with the icons (a photo icon and a chart icon) have no way to know what they do without hovering or guessing. On mobile, there is no hover.

**Challenges:**
- MA-01 says "toggled via a checkbox in the content area toolbar" — no acceptance criterion requires a visible label.
- WCAG 2.1 Success Criterion 1.1.1 requires non-text content to have a text alternative, which `aria-label` satisfies technically — but visible labels are a stronger UX choice.

**Recommendations:**
- Add short visible labels ("Photo", "Poll") below or beside the icon toggles.
- Keep the `aria-label` for screen readers.
- Update MA-01 and PL-01 to require visible affordance.

---

### 1.7 No onboarding after first login 🟠

**Heuristic violated:** Help and documentation + Match between system and real world

The first thing a new user sees after OAuth is the composer — a blank textarea with unlabelled controls, no guidance, and a long empty "Scheduled Toots" section below. There is no tutorial, no tooltip, no placeholder instructing them to start.

**Challenges:**
- EP-01 covers the landing page and login flow, but there is no epic for **post-login onboarding**.
- The placeholder text in the textarea is "What's on your mind?" — which is familiar from social networks but gives no hint about scheduling.
- There is no user story for "first time experience" or "guided setup".

**Recommendations:**
- Add a first-visit banner or coach mark explaining the scheduling concept.
- Change the textarea placeholder to something like "What do you want to say? Choose a date and time below to schedule it."
- Add a new user story: "As a first-time user, I want to be guided through creating my first scheduled toot."

---

### 1.8 Session timeout resets unsaved work 🟠

**Heuristic violated:** Error prevention + User control and freedom

If a user is composing a toot when the 30-minute inactivity timer fires (US-27), they are logged out and the composer content is lost. Because the session timer resets on any mouse/keyboard activity, this scenario is rare — but becomes realistic when a user pauses mid-composition.

**Challenges:**
- US-26 (session warning) and US-27 (auto-logout) do not interact with the compose state. The "extend session" action does not save the draft.
- This compounds the draft persistence gap (Finding 1.3).

**Recommendations:**
- Save compose state before executing the auto-logout.
- Restore the draft after re-authentication.

---

### 1.9 Edit flow scrolls to textarea but provides no visual cue that edit mode is active 🟡

**Heuristic violated:** Visibility of system status

When the user clicks "Edit" on a toot card, the page scrolls to the composer and the fields are populated. However, there is no persistent visual indicator that the composer is in "edit mode" — only the button label changes from "Schedule" to "Update". A user who scrolled away and back might forget they are editing.

**Challenges:**
- TC-10 covers the button label change, but no criterion addresses a persistent edit-mode indicator.

**Recommendations:**
- Add a labelled banner at the top of the composer: "Editing a scheduled toot — changes will replace the original."
- Apply a visual distinction (e.g. border, background tint) to the composer container in edit mode.
- Update US-11 to include a persistent edit-mode indicator as an acceptance criterion.

---

### 1.10 Browser `confirm()` is not accessible 🔴

**Heuristic violated:** Accessibility (WCAG 2.1 SC 4.1.3)

`window.confirm()` is not reliably accessible to screen reader users and is blocked in some browser contexts (iframes, certain CSP configurations). It provides no customisable focus management and ignores the application's visual design.

**Challenge:** This is the same issue as 1.1, but with an accessibility dimension that makes it critical. The BRD has an accessibility requirement (AC-01) but US-23 does not enforce it for the delete confirmation.

**Recommendation:** Same as 1.1 — replace with `ModalView`.

---

## 2. Business Findings

### 2.1 Value proposition is undermined by inaccurate claims 🔴

The landing page states: *"The first toot scheduling service of all time!"* and the BRD repeats the positioning that this fills a gap. This is factually incorrect — Mastodon's own web interface supports scheduling, and several third-party tools (Fedica, Publer, Buffer) also do. The FAQ doubles down with: *"First scheduling toot service, really? Yep, sort of. I'm all into this fake it till you make it thing."*

**Challenges:**
- The BRD does not define a competitive positioning section. There is no analysis of what differentiates this app from Mastodon's native scheduling or existing tools.
- G1 ("without needing a third-party service with a backend") is the real differentiator — a privacy-first, no-backend, open-source scheduler — but this is buried in the BRD and absent from the landing page.

**Recommendations:**
- Rewrite the value proposition around the actual differentiator: "Schedule toots directly from your browser — no accounts, no servers, your data stays on your instance."
- Remove the "first ever" claim. Replace with honest positioning.
- Add a competitive differentiation section to the BRD.

---

### 2.2 Business goals lack measurable success metrics 🟠

The BRD defines 5 business goals (G1–G5) with "success indicators" — but they are all binary (can/cannot do something), not measurable. There is no definition of what good looks like at scale.

**Challenges:**
- G3 ("store no user data") has no verification mechanism — there are no tests or monitoring to confirm data is not inadvertently persisted.
- G5 ("3-step experience") is aspirational but untestable without user research.
- There are no KPIs: no retention metric, no activation rate, no error rate target.

**Recommendations:**
- Define at least one quantitative metric per goal. Examples:
  - G1: "≥ 90% of first-time users successfully schedule a toot within 5 minutes of connecting"
  - G4: "App works with any instance responding to standard Mastodon API v1 endpoints"
  - G5: "Median time from landing page to first scheduled toot < 3 minutes"
- Add an analytics section to the BRD — even basic (anonymised) telemetry via a privacy-respecting tool would provide signal.

---

### 2.3 Only one user persona is defined 🟡

The BRD defines a single primary user: "any Mastodon user who wants to plan posts in advance". This is too broad to be useful for design decisions. Different user types have meaningfully different needs.

**Challenges:**
- A casual user posting once a week has different priorities (simplicity, speed) than a content creator managing 20 scheduled posts (bulk actions, queue overview, status visibility).
- No user story currently covers power-user workflows.

**Recommended personas to define:**

| Persona | Description | Primary need |
|---------|-------------|--------------|
| Casual poster | Posts occasionally, low volume | Fast, frictionless single-toot scheduling |
| Content creator | Manages a regular posting schedule | Overview, edit, and manage multiple queued toots |
| Community manager | Posts on behalf of a project or community | Reliability, visibility settings, language control |

---

### 2.4 Known gaps are listed but not prioritised or owned 🟠

Both the BRD (§9) and the user stories (Known Gaps section) document 5 security and UX gaps — but none have a priority, owner, or target version. A gap that is "known" but unscheduled will remain unaddressed indefinitely.

**Challenges:**
- GAP-01 (missing OAuth `state`) and GAP-03 (no CSP) are security issues — they should be treated as bugs, not backlog items.
- GAP-04 (no client-side file validation) is a UX regression risk — a user uploading a 200 MB file gets a silent API error.
- GAP-02 and GAP-05 are architectural trade-offs that need a clear "accepted for now, revisit at version X" decision.

**Recommendations:**

| Gap | Recommended priority | Action |
|-----|---------------------|--------|
| GAP-01 OAuth state | 🔴 Critical / Sprint 1 | Implement before any production promotion |
| GAP-03 No CSP | 🔴 Critical / Sprint 1 | Add meta CSP tag — low effort, high protection |
| GAP-04 No file validation | 🟠 High / Sprint 2 | 2-line fix, unblocks clean upload errors |
| GAP-05 HTTP warning | 🟡 Medium / Sprint 2 | Warn user inline in login form |
| GAP-02 localStorage | 🟢 Low / Later | Document as accepted trade-off with `sessionStorage` migration path |

---

### 2.5 No retention or re-engagement mechanism 🟡

Once a user schedules a toot, there is nothing that brings them back to the app. There is no notification when a scheduled toot goes live, no summary of past posts, no reminder to keep their queue filled.

**Challenges:**
- The BRD lists "push notifications" as Out of Scope. This is reasonable. But there are simpler retention levers that don't require a backend.
- The FAQ does not mention sharing, bookmarking, or returning to the app.

**Recommendations:**
- Add a "Add to home screen" PWA prompt — the app is already structured as an SPA and would require minimal changes.
- Display "Your next scheduled toot goes out in X hours" in the composer header as a retention nudge.
- Consider this a new user story: "As a returning user, I want to see a summary of my upcoming scheduled toots at a glance."

---

### 2.6 "Out of Scope" items may exclude high-value quick wins 🟡

The BRD's Out of Scope section (§10) lists "publishing toots immediately" and "recurring toots" as excluded. These are worth re-examining.

**Challenges:**
- **Immediate publishing** is a natural extension of the existing flow — it would simply remove the `scheduled_at` parameter. Users who discover this tool while composing a toot may want to use it as their primary composer.
- **Recurring toots** are complex, but a simplified version (e.g. a weekly reminder to re-schedule a pinned toot) could be valuable with minimal backend.
- Neither exclusion has a stated rationale in the BRD.

**Recommendations:**
- Add a "Rationale" column to the Out of Scope section explaining why each item was excluded.
- Consider "Publish now" as a quick win — it is a 1-line API change (remove `scheduled_at`) and covers the use case of users composing on mobile without scheduling intent.

---

### 2.7 FAQ tone creates a trust gap for some audiences 🟡

The landing page FAQ includes: *"Is it totally secure? Yes, it is. All scheduled toots are stored on your account's instance. We don't store any goddamn thing!"* and *"Yep, sort of. I'm all into this fake it till you make it thing."*

**Challenges:**
- For a security-conscious user considering connecting their Mastodon credentials, "Yes, it is" and "goddamn" undermine confidence — not because of the content but because the tone signals low investment in accuracy.
- The actual privacy model is strong and worth communicating seriously.

**Recommendations:**
- Keep the personality — it is part of the product's charm — but ground security claims in specifics: "Your access token is stored only in your browser. We have no server, no database, no analytics. There is nothing to breach."
- Separate tone from substance: casual voice, precise claims.

---

## 3. User Story Gaps

Stories that are missing from the current document based on UX and business best practices.

| ID | Proposed story | Priority | Related finding |
|----|----------------|----------|-----------------|
| US-29 | As a first-time user, I want to be guided through creating my first scheduled toot, so that I understand the workflow without reading documentation | 🟠 High | 1.7 |
| US-30 | As a user with unsaved compose content, I want to be warned before my content is lost (tab close, logout, navigation), so that I don't lose work | 🟠 High | 1.3, 1.8 |
| US-31 | As a user, I want to see clear confirmation after successfully scheduling a toot, so that I know my action was completed | 🟠 High | 1.2 |
| US-32 | As a user in edit mode, I want a persistent visual indicator that I am editing an existing toot, so that I don't accidentally discard my changes | 🟡 Medium | 1.9 |
| US-33 | As a user who deleted a toot by mistake, I want a brief window to undo the deletion, so that I can recover without recreating the toot | 🟡 Medium | 1.1 |
| US-34 | As a user uploading a media file, I want to see a clear error if the file is too large or in the wrong format, so that I understand why the upload failed | 🟠 High | GAP-04 |
| US-35 | As a returning user with a draft in progress, I want my unsaved compose state to be restored, so that I can resume where I left off | 🟡 Medium | 1.3 |
| US-36 | As a content creator managing multiple toots, I want to see a summary of my scheduled toots at a glance from the composer header, so that I can plan my posting schedule | 🟢 Low | 2.5 |
| US-37 | As a user on a slow connection, I want to see a loading indicator while the scheduled toots list is being fetched on initial load, so that I know the app is working | 🟡 Medium | ST-10 exists but scope is narrow |

---

## 4. Prioritised Recommendations

Consolidated list, ordered by impact vs. effort.

| Priority | Finding | Effort | Impact | Recommended action |
|----------|---------|--------|--------|--------------------|
| 🔴 1 | GAP-01: Missing OAuth `state` | Low | Critical | Implement before any public promotion |
| 🔴 2 | GAP-03: No CSP | Very low | Critical | Add `<meta>` CSP tag |
| ~~🔴 3~~ | ~~1.1 / 1.10: `window.confirm()` for delete~~ | ~~Low~~ | ~~High~~ | ✅ Fixed — `DeleteConfirmModal.vue` + `ModalView` |
| 🔴 4 | 1.6: Unlabelled media / poll toggles | Low | High | Add visible "Photo" / "Poll" labels |
| 🟠 5 | 1.2: No success feedback | Very low | High | Add toast on schedule/update success |
| 🟠 6 | GAP-04: No file validation | Low | High | Validate MIME type and size before upload |
| 🟠 7 | 1.3: No draft persistence | Medium | High | Save compose state to `sessionStorage` |
| 🟠 8 | 2.1: Inaccurate value proposition | Very low | High | Rewrite landing page copy |
| 🟠 9 | 1.7: No post-login onboarding | Medium | High | First-visit coach mark / better placeholder |
| 🟡 10 | 1.5: Separate date/time fields | Low | Medium | Unify to `datetime-local` |
| 🟡 11 | 1.4: Ambiguous character counter | Very low | Medium | Switch to `X / 500` format |
| 🟡 12 | 1.9: No persistent edit-mode indicator | Low | Medium | Add edit-mode banner to composer |
| 🟡 13 | 2.4: Unowned known gaps | None (process) | Medium | Assign priority and sprint to each gap |
| 🟡 14 | 2.2: No measurable success metrics | None (process) | Medium | Add KPIs to BRD business goals |
| 🟡 15 | GAP-05: HTTP not warned | Very low | Medium | Inline warning in login form |
| 🟢 16 | 2.6: "Publish now" out of scope | Low | Medium | Reconsider — 1-line API change |
| 🟢 17 | 2.3: Single persona | None (process) | Low | Define 3 personas in BRD |
| 🟢 18 | 2.5: No retention nudge | Low | Low | Show "next toot in X hours" in header |
| 🟢 19 | 2.7: FAQ tone vs. trust | Very low | Low | Rewrite security FAQ with specific claims |
