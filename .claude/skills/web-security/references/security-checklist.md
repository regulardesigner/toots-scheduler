# Web Security Audit Checklist

Use this checklist when reviewing a new feature or auditing existing code.
Each item is a question to ask about the code under review — not an assumption about what the project does.

---

## XSS — Cross-Site Scripting

- [ ] Is `v-html` used anywhere? If yes: is the value sanitized with DOMPurify before rendering?
- [ ] Is `innerHTML`, `outerHTML`, or `document.write` used anywhere?
- [ ] Are `href` or `src` attributes bound to user-supplied or API-sourced values? If yes: are `javascript:` and `data:` URIs rejected?
- [ ] Is content from the Mastodon API (toot text, display names, bios) rendered with `{{ }}` interpolation only?
- [ ] Are any new dynamic attributes created that could be vectors (e.g. `:style`, `:class` with user data)?

## Authentication

- [ ] Is any token, client_secret, or authorization code written to `console.log`?
- [ ] Is the Bearer token ever sent as a URL query parameter?
- [ ] Is the access token stored in `localStorage`? If yes: has `sessionStorage` been evaluated as an alternative?
- [ ] Is the token validated against the instance on app startup — not just assumed valid?
- [ ] Does every API call that can return `401` trigger a proper logout and redirect, not a silent failure?
- [ ] Are there any hardcoded credentials or secrets in source files or `.env` files tracked by git?

## OAuth 2.0

- [ ] Does the authorization URL include a `state` parameter? (generated with `crypto.randomUUID()`, stored in `sessionStorage`)
- [ ] Is the `state` value verified on the callback before the authorization code is exchanged?
- [ ] Are only the minimum necessary OAuth scopes requested?
- [ ] Is the authorization `code` consumed immediately and never cached, stored, or logged?
- [ ] Are `client_id` and `client_secret` read from environment variables — not hardcoded?

## CSRF

- [ ] Is the OAuth `state` parameter implemented? (Primary CSRF risk in this app)
- [ ] Does any feature use cookie-based authentication? If yes: are CSRF tokens or `SameSite=Strict` in place?

## URL & input validation

- [ ] Is any user-supplied URL concatenated directly into an API endpoint string? (SSRF risk)
- [ ] Is every external URL validated with a strict parser that extracts only the `origin`?
- [ ] Are instance URLs constrained to HTTPS? Is the user warned if HTTP is entered?
- [ ] Are OAuth redirect URIs built from `window.location.origin` only — never from user input?
- [ ] Are text inputs length-bounded to prevent oversized payloads?
- [ ] Are file uploads validated for MIME type before being sent?
- [ ] Are file uploads validated for size before being sent?

## Content Security Policy

- [ ] Is a CSP defined (response header or `<meta>` tag)?
- [ ] Does the CSP include `script-src 'self'` without `unsafe-inline` or `unsafe-eval`?
- [ ] Does the CSP include `frame-ancestors 'none'` (clickjacking protection)?
- [ ] Does the CSP restrict `connect-src` to expected origins only?

## Sensitive data exposure

- [ ] Do UI error messages expose stack traces, internal paths, or API response bodies?
- [ ] Are `VITE_` environment variables used only for non-secret configuration? (They are bundled into the client.)
- [ ] Are `.env` files excluded from version control via `.gitignore`?
- [ ] Does the app have a `.env.example` that documents required variables without real values?

## Dependency security

- [ ] Has `npm audit` been run? Are there `high` or `critical` findings?
- [ ] Is any new package actively maintained (recent publish date, no abandoned issues)?
- [ ] Does any new package run `postinstall` scripts? If yes: is the script inspected?
- [ ] Are security-critical packages pinned to exact versions (no `^` or `~`)?

## API response handling

- [ ] Are API responses validated for shape before accessing nested properties?
- [ ] Are list responses paginated or bounded before rendering?
- [ ] Is user-generated content from API responses treated as untrusted throughout the render path?

---

## OWASP Top 10 — mapping to this project

| OWASP Category | Relevant in this project | Primary concern |
|----------------|--------------------------|-----------------|
| A01 Broken Access Control | Low | OAuth scopes, token leakage |
| A02 Cryptographic Failures | Medium | Token in localStorage, HTTP instances |
| A03 Injection (XSS) | **High** | Toot content, display names rendered in DOM |
| A04 Insecure Design | Medium | Missing OAuth state, no CSP |
| A05 Security Misconfiguration | Medium | No CSP, no security headers |
| A06 Vulnerable Components | Medium | npm dependencies |
| A07 Auth Failures | Medium | Token storage, session management |
| A08 Software Integrity | Low | Dependency supply chain |
| A09 Logging Failures | Low | Console logging of tokens |
| A10 SSRF | Low | URL validation for instance input |

---

## References

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP XSS Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OAuth 2.0 Security Best Practices (RFC 9700): https://datatracker.ietf.org/doc/html/rfc9700
- CSP Reference: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- DOMPurify: https://github.com/cure53/DOMPurify
