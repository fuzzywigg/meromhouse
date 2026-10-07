# Link check and dependency audit — 2026-10-07

Technical pass on top of `cursor/integration-lighthouse-perf-25a2` (PR #39). No site copy or text changes. Draft PR only; do not merge from this run.

## What was added

| Gate | Location | Notes |
|------|----------|--------|
| Offline internal link / asset checker | `scripts/check-links.mjs`, `npm run check:links` | Resolves every `href` / `src` in `index.html`, plus `srcset`, CSS `url()`, same-origin `og:*` / `twitter:image` / `og:url`, `site.webmanifest` icons / `start_url`, and `sitemap.xml` `<loc>`. External, `mailto:`, `tel:`, and `data:` refs are skipped (no network). |
| Known routes | Same script | `/` plus Pages Function paths discovered from `functions/api/*.js` (`/api/health`, `/api/github-stats`). Accepted without a static file. |
| Unit coverage | `test/links.test.js` | Imports the shared checker; still runs under `npm test`. |
| CI step | `.github/workflows/ci.yml` | Dedicated `npm run check:links` before unit tests. |
| npm audit (report-only) | CI | `npm audit` with `continue-on-error: true` — logs findings, never fails the job. |
| Action pin + permissions | CI | `actions/checkout` and `actions/setup-node` pinned to commit SHAs (annotated with tag). Workflow-level `permissions: contents: read`. |

### Local commands

```bash
npm ci
npm run check:links      # offline internal link / asset check (exit 1 on miss)
npm test                 # includes link unit tests
npm run validate:html    # html-validate on index.html
npm run test:e2e         # Playwright smokes
npm audit                # dependency advisory report (local; non-blocking in CI)
```

## Defects found and fixed

**No broken internal paths.** The checker reported 24 internal refs, all resolving to repo files or known routes:

- Favicons / apple-touch / manifest
- Self-hosted Source Sans 3 woff2 (preload + `@font-face` `url()`)
- `/assets/dashboard.js`
- OG image meta + lazy `picture` srcset (`og-image-600.{avif,webp,jpg}`)
- `#main` skip link
- Sitemap `https://meromhouse.org/` → `index.html`
- Manifest icons and `start_url: /`

No HTML `href` / `src` path edits were required.

## CI hardening details

| Item | Before | After |
|------|--------|--------|
| `actions/checkout` | `@v7` floating major | `@3d3c42e5aac5ba805825da76410c181273ba90b1` (# v7.0.1) |
| `actions/setup-node` | `@v7` floating major | `@820762786026740c76f36085b0efc47a31fe5020` (# v7.0.0) |
| Permissions | Job-level `contents: read` | Workflow-level `permissions: contents: read` |
| Link check | Only via `npm test` → `test/links.test.js` | Explicit `npm run check:links` CI step + unit tests |
| npm audit | Not in CI | Report-only step (`continue-on-error: true`) |

## Out of scope

- Live probing of third-party URLs (GitHub, LinkedIn, YouTube, fuzzywigg.ai)
- Content / copy edits
- Production deploy
- Merging this PR or PR #39

## Verification

Recorded after the changes on this branch:

| Command | Result |
|---------|--------|
| `npm run check:links` | **ok** (24 internal refs; known routes `/`, `/api/github-stats`, `/api/health`) |
| `npm test` | **67/67 pass** |
| `npm run validate:html` | **pass** |
| `CI=true npm run test:e2e` | **20/20 pass** |
| `npm audit` | **0 vulnerabilities** (also non-blocking in CI via `continue-on-error`) |
