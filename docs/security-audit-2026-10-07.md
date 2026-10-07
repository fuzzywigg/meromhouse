# Security audit — 2026-10-07

Technical hardening pass on `fuzzywigg/meromhouse`. No deploy. No secrets or Cloudflare account/config changes. No site copy changes.

## Scope

| Area | Action |
|------|--------|
| npm dependencies | Audit / outdated (none present) |
| GitHub Actions | Review major-vs-minor pins |
| HTTP security headers | Strengthen `_headers` + API Function responses |
| Site copy / content | Untouched (including grants, funding, Sullivan County, data center, energy park, nonprofit language) |

## Dependency audit

### npm audit / outdated

This repo has **no `package.json` and no `package-lock.json`**. The dashboard is static HTML plus Cloudflare Pages Functions with zero committed npm dependencies (see README stack note).

Commands run 2026-10-07 (UTC):

```text
$ test -f package.json; echo $?
1

$ npm audit
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.

$ npm outdated
(no output; exit 0)
```

**Result:** Nothing to patch or minor-bump in-repo. No major upgrades considered.

### Transient / external tooling (not repo deps)

| Tool | How used | Notes |
|------|----------|-------|
| `wrangler@4` | `npx` in `.cursor/environment.json` `start` and local/dev docs | Observed `4.148.0` via `npx --yes wrangler@4 --version`. Not locked in this repo; no major jump to wrangler 5. |
| `actions/checkout@v4` | CI | Floating v4 major; Dependabot watches `github-actions`. Do not bump to v5 in this pass. |
| `actions/setup-node@v4` | CI | Same as above. |

Dependabot already covers GitHub Actions weekly (`.github/dependabot.yml`). No npm ecosystem entry is needed until a `package.json` exists.

## Security headers

### Before

`_headers` (static assets only) already had:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cache-Control: public, max-age=300`

Missing: HSTS, Permissions-Policy, CSP (any mode). Pages Function responses (`/api/*`) did not inherit `_headers` (Cloudflare Pages limitation).

### After

**Static assets (`_headers`):**

- Kept existing frame / MIME / referrer / cache headers
- Added `Permissions-Policy` (camera, mic, geo, payment, usb, motion sensors disabled)
- Added `Strict-Transport-Security: max-age=31536000; includeSubDomains` (no `preload` — HITL if ever submitted to the HSTS preload list)
- Added `Content-Security-Policy-Report-Only` aligned to the current page:
  - `default-src 'self'`; `connect-src 'self'` (same-origin `/api/*` fetches)
  - `script-src` / `style-src` allow `'unsafe-inline'` because `index.html` uses inline `<script>` and `<style>`
  - `img-src 'self' data:`; `font-src 'self'`; `manifest-src 'self'`
  - `base-uri 'self'`; `object-src 'none'`; `frame-ancestors 'none'`
  - No `report-uri` / `report-to` yet (would need a reporting endpoint and possibly new credentials — escalate)

**API Functions:**

- New shared module `functions/_shared/security-headers.js`
- Applied on `/api/health` and `/api/github-stats` (CORS behavior unchanged)

CSP remains **report-only** so browsers will not block resources; promote to enforcing `Content-Security-Policy` only after console review (and ideally a report collector).

## Verification

```bash
node --test test/*.test.js
# 20 tests, 0 failures (includes new test/headers.test.js)

curl -sI http://127.0.0.1:8788/
# Confirmed: CSP-RO, HSTS, Permissions-Policy, X-Content-Type-Options,
# Referrer-Policy, X-Frame-Options

curl -sI http://127.0.0.1:8788/api/health
# Confirmed: HSTS, Permissions-Policy, Referrer-Policy, X-Content-Type-Options
```

CI also runs the secret-material grep and required-file checks; `_headers` remains a required keeper file.

## Explicit non-goals (this pass)

- Production deploy / Pages publish
- Cloudflare dashboard, DNS, custom-domain, or account settings
- Adding secrets or third-party report endpoints
- Major dependency upgrades
- Any `index.html` copy or branding edits

## Follow-ups (optional, HITL)

1. After watching CSP-RO in production browsers, flip to enforcing CSP (may require hashing or moving inline JS/CSS out of `index.html`).
2. Add a CSP report endpoint if durable violation telemetry is wanted.
3. Consider HSTS preload only after deliberate subdomain inventory.
4. If wrangler or other tooling should be audited in-repo, introduce a minimal `package.json` + lockfile and Dependabot `npm` ecosystem — out of scope here.
