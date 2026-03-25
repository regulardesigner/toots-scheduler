---
name: web-security
description: >
  Web security auditing for the Toot Scheduler project. Use this skill whenever writing,
  reviewing, or refactoring any code — even if the user does not mention security. Trigger
  on: authentication, token handling, user input, API calls, URL handling, file uploads,
  data storage, new dependencies, or any feature exposed to the user. This skill challenges
  the codebase against web security best practices and must be loaded alongside vue3-codegen
  and mastodon-api for any feature touching auth or external data.
---

# Web Security — Challenge Guide

This skill is not a description of what the project does.
It is a set of standards the project must be **challenged against** on every change.
When reviewing code, assume nothing is safe until verified against each section below.

For the full per-category audit checklist, read `references/security-checklist.md`.

---

## 1. Cross-Site Scripting (XSS)

XSS is the most common vulnerability in browser apps. It allows attackers to inject and run arbitrary JavaScript in the victim's browser.

**Challenge every template:**
- Is any user-supplied or API-sourced data rendered with `v-html`, `innerHTML`, `outerHTML`, or `document.write`? If yes — this is a critical vulnerability unless a proven sanitizer (e.g. `DOMPurify`) is applied first.
- Vue's `{{ }}` interpolation is safe — it escapes HTML. `v-html` bypasses this entirely.
- Mastodon API data (toot content, display names, bio fields) can contain arbitrary HTML — never trust it.
- `href` and `src` attributes bound to user data must be validated — `javascript:` URIs are a vector.

```vue
<!-- ❌ Critical XSS risk -->
<p v-html="toot.content" />
<a :href="userInput" />

<!-- ✅ Safe -->
<p>{{ toot.content }}</p>
<a :href="sanitizedUrl">link</a>
```

**Remediation:** If rich text rendering is genuinely needed, install `DOMPurify` and wrap all external HTML: `DOMPurify.sanitize(value, { ALLOWED_TAGS: ['b', 'i', 'a'] })`.

---

## 2. Authentication & token security

Based on OWASP Authentication Cheat Sheet and OAuth 2.0 Security Best Practices (RFC 9700).

**Token storage — challenge:**
- Tokens stored in `localStorage` are readable by any JavaScript on the page. A single XSS vulnerability exposes every token to theft.
- `sessionStorage` limits exposure to the current tab and is cleared on close — always prefer it for tokens.
- `HttpOnly` cookies are the most secure option as they are inaccessible to JavaScript entirely — requires a backend.
- **Ask:** does this project need `localStorage` persistence, or would `sessionStorage` be acceptable?

**Token handling — challenge:**
- Is the Bearer token ever logged, sent as a query parameter, or included in a URL? All three expose it in logs and browser history.
- Is the token validated against the instance on every app start, or is it used blindly? A revoked or expired token must trigger logout.
- Does the app handle `401 Unauthorized` responses gracefully everywhere — not just on startup?

**OAuth 2.0 — challenge:**
- Does the authorization request include a `state` parameter? Without it, the callback is vulnerable to CSRF — an attacker can inject their own authorization code.
  - The `state` must be: generated with `crypto.randomUUID()`, stored in `sessionStorage`, sent in the auth URL, and verified on callback before the code is exchanged.
- Is the `client_secret` exposed in the browser? For a SPA without a backend, this is unavoidable — but it should be documented as a known trade-off, and scope minimization must compensate.
- Are OAuth scopes the minimum required? Every extra scope is an additional attack surface if the token is stolen.
- Is the authorization code consumed immediately and never cached or logged?

---

## 3. Cross-Site Request Forgery (CSRF)

CSRF is less critical for APIs using Bearer tokens (since cookies are not used for auth), but remains relevant for the OAuth flow.

**Challenge:**
- Is the OAuth `state` parameter implemented? (See §2.) Its absence is the primary CSRF risk in this app.
- Does any endpoint rely on cookie-based authentication? If one is added in the future, CSRF tokens or `SameSite=Strict` cookies are required.
- Does any `<form>` POST to a backend? If so, it needs a CSRF token.

---

## 4. URL & input validation

**Challenge every URL:**
- Is raw user input ever concatenated into an API endpoint string? This enables Server-Side Request Forgery (SSRF) — an attacker could point the app at an internal server.
- Is the instance URL constrained to HTTPS? Sending tokens over HTTP exposes them in plaintext.
- Is the URL parsed with a strict validator (e.g. the native `URL` constructor) that extracts only the `origin`? Relative URLs, `javascript:` schemes, and paths injected by the user must be rejected.
- Are redirect URIs for OAuth built from trusted values only (`window.location.origin`), never from user input?

**Challenge every form input:**
- Is the length of text inputs bounded? Unbounded inputs can cause DoS or unexpected API failures.
- Are file uploads validated for MIME type **and** size before being sent to the API? Client-side validation improves UX and reduces unnecessary requests — but remember it is not a security boundary (server-side validation is authoritative).

---

## 5. Content Security Policy (CSP)

CSP is a browser-level defense-in-depth measure that limits where scripts, styles, and media can be loaded from. It does not prevent all XSS but severely limits the damage.

**Challenge:**
- Does the app define CSP headers? Check `vite.config.ts` or the hosting configuration (GitHub Pages, Netlify, etc.).
- A minimal effective CSP for this app:
  ```
  Content-Security-Policy:
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https:;
    frame-ancestors 'none';
  ```
- `unsafe-inline` for scripts must be avoided — it negates most XSS protection. If Vue requires it, use a nonce-based approach.
- `frame-ancestors 'none'` prevents clickjacking.

**Remediation:** Add CSP as a meta tag for GitHub Pages deployments (where response headers cannot be set):
```html
<meta http-equiv="Content-Security-Policy" content="...">
```
Note: meta-tag CSP does not support `frame-ancestors` — that requires a response header.

---

## 6. Sensitive data exposure

**Challenge:**
- Are tokens, secrets, or authorization codes ever written to `console.log`? They will appear in browser DevTools and can be captured by browser extensions.
- Do error messages shown to the user expose internal details (stack traces, file paths, API responses)? Error messages must be user-friendly and opaque to internal structure.
- Are environment variables (`.env`) containing secrets committed to the repository? `VITE_` prefixed variables are **bundled into the client** — they are not secret. No private API keys should use this prefix.
- Are there any hardcoded credentials, instance URLs, or tokens in source files?

---

## 7. Dependency security

Every dependency is a potential attack vector. Supply chain attacks are increasingly common.

**Challenge before adding any new package:**
- Is the package actively maintained? Check last publish date, open issues, and GitHub stars.
- Does it have known CVEs? Check `npmjs.com` and `snyk.io`.
- Is it the minimum needed, or does a native browser API cover the use case?
- Does it have excessive permissions (e.g. a utility that runs postinstall scripts)?

**Before every release:**
```bash
npm audit
# Address all high and critical severity issues before shipping.
npm audit fix  # for automatic fixes
```

**Pin dependencies** where security is critical — avoid open ranges (`^`, `~`) for auth-related packages.

---

## 8. API response handling

**Challenge:**
- Is every API response validated before use? Malicious or unexpected responses from a rogue Mastodon instance should not cause the app to crash or expose data.
- Are array responses bounded before rendering? An instance returning 10,000 scheduled toots should not freeze the UI.
- Is user-generated content from the API (toot text, media descriptions) treated as untrusted — rendered safely and never injected into the DOM?

---

## 9. Secure defaults checklist

When implementing any new feature, verify these defaults are in place:

| Concern | Expected default |
|---------|-----------------|
| Token in URL | ❌ Never — always in `Authorization` header or request body |
| `v-html` with external data | ❌ Never — use `{{ }}` or DOMPurify |
| `localStorage` for new secrets | ❌ Prefer `sessionStorage` |
| HTTP instance URL | ⚠️ Warn user — tokens sent in plaintext |
| OAuth without `state` | ⚠️ CSRF risk — implement before production |
| `console.log` with token/secret | ❌ Remove before shipping |
| Unvalidated file upload | ❌ Always check type + size |
| Raw user input in API URL | ❌ Always use `normalizeUrl()` or equivalent |
| CSP header/meta | ✅ Should be defined |
| `npm audit` clean | ✅ Required before release |
