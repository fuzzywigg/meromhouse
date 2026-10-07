# Security headers — Worker response recommendations — 2026-10-07

Engineering-only gate on top of `cursor/ci-html-polish-b35d` (#44). **No site copy changes. No `wrangler.toml` edits. No secrets.** Draft PR only; do not merge from this run.

## Why a separate check

Cloudflare Pages applies `_headers` to **static** responses only. Pages Function (Worker) routes under `/api/*` set their own headers in `functions/api/*.js` via `functions/_shared/security-headers.js`. This probe reads **live local Worker responses** and reports gaps against the recommended set without changing config.

## Recommended headers

### Document / static (`/` via `_headers`)

| Header | Recommended value | Notes |
|--------|-------------------|--------|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing guard |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `X-Frame-Options` | `DENY` | Clickjacking guard (pairs with CSP `frame-ancestors`) |
| `Permissions-Policy` | sensors / camera / mic / geo / payment / usb disabled | Feature lockdown |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS only (no `preload` unless HITL) |
| `Content-Security-Policy-Report-Only` | policy aligned to self-hosted assets | Keep report-only until console review; no report endpoint / credentials |

### Worker / API (`/api/health`, `/api/github-stats`)

| Header | Recommended value | Notes |
|--------|-------------------|--------|
| `X-Content-Type-Options` | `nosniff` | Already on shared `SECURITY_HEADERS` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Already on shared module |
| `Permissions-Policy` | same lockdown as static | Already on shared module |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Already on shared module |
| `X-Frame-Options` | `DENY` | **Recommended** for parity with static; may be absent on Worker today — report-only until a deliberate Functions change |

JSON APIs do not need `Content-Security-Policy-Report-Only` (no HTML document context). Optional later: `Cache-Control` remains per-route (not part of this security probe).

## Gate behavior

| Gate | Location | Blocking? | Notes |
|------|----------|-----------|--------|
| Header scanner fixtures | `test/security-headers.test.js` | Yes (unit) | Synthetic maps only; no network |
| Live Worker / document probe | `scripts/check-security-headers.mjs`, `npm run check:security-headers` | **Report-only** | Starts local `wrangler pages dev` when `SECURITY_HEADERS_BASE_URL` is unset; CI uses `continue-on-error: true` |
| Existing static + Function unit asserts | `test/headers.test.js` | Yes | Unchanged; still asserts current `_headers` + shared module |

### Local commands

```bash
npm ci
npm run check:security-headers          # serve + probe (exit 1 on gaps; report-only in CI)
SECURITY_HEADERS_BASE_URL=http://127.0.0.1:8788 npm run check:security-headers
npm test                                # includes fixture suite
npm run test:qa                         # includes security-headers unit file
```

## Explicit non-goals

- Editing `wrangler.toml`, Cloudflare dashboard bindings, or secrets
- Promoting CSP from Report-Only to enforcing
- Adding a CSP report collector (would need credentials — escalate)
- Production deploy / merge
- Site copy or branding changes

## Follow-ups (optional, HITL)

1. Add `X-Frame-Options: DENY` (or rely solely on CSP `frame-ancestors`) on Function responses when ready.
2. After watching CSP-RO in production, consider enforcing CSP on the HTML shell.
3. HSTS preload only after deliberate subdomain inventory.
