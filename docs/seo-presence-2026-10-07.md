# Document presence gates — 2026-10-07

Engineering-only polish on top of `cursor/integration-fold-40-41-42-1bd6`. No site copy or wording changes. Draft PR only; do not merge from this run.

## Gates

| Gate | Location | Blocking? | Notes |
|------|----------|-----------|--------|
| Offline internal link / asset checker | `scripts/check-links.mjs`, `npm run check:links` | Yes | Inherited from #40; no external network. |
| Local HTML validation | `html-validate`, `.htmlvalidate.json`, `npm run validate:html` | Yes | Explicit CI step + unit coverage in `test/html-validate.test.js`. |
| Title / meta description / lang presence | `scripts/check-seo-presence.mjs`, `npm run check:seo` | **Report-only** | Presence of `<title>`, `<meta name="description">`, and `html[lang]` on every site HTML page. Does not invent or edit wording. CI uses `continue-on-error: true`. |

### Local commands

```bash
npm ci
npm run check:links      # offline internal refs (fails on miss)
npm run validate:html    # local html-validate (fails on error)
npm run check:seo        # presence report (exit 1 on gap; report-only in CI)
npm test                 # includes fixture + report-only SEO suite
```

## Out of scope

- Writing or editing page titles, meta descriptions, or any other copy
- Live probing of third-party URLs
- Production deploy / merge
