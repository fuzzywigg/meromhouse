# Technical SEO / metadata gates — 2026-10-07

Engineering-only pass on top of the #53 integration tip (`cursor/integration-fold-52-onto-51-c333`). No substantive site copy about grants, fundraising, nonprofit plans, data centers, or energy projects. Where social tags needed a description, existing `<title>` / meta description wording was reused. Draft PR only; do not merge from this run.

## Gates

| Gate | Location | Blocking? | Notes |
|------|----------|-----------|--------|
| Offline internal link / asset checker | `scripts/check-links.mjs`, `npm run check:links` | Yes | Inherited; no external network. |
| Local HTML validation | `html-validate`, `.htmlvalidate.json`, `npm run validate:html` | Yes | Includes img `alt` attribute presence. |
| Technical SEO / metadata | `scripts/check-seo-presence.mjs`, `npm run check:seo` | **Yes** | Titles + descriptions (present, non-empty, unique), canonical, OG/Twitter (present + reuse page title/description), robots.txt, sitemap.xml, favicon/manifest, heading hierarchy, img `alt`. |
| Playwright SEO smoke | `test/e2e/seo.smoke.spec.js` | Yes | Live document + `/robots.txt` / `/sitemap.xml` / manifest / favicon / OG image reachability. |

### Local commands

```bash
npm ci
npm run check:links      # offline internal refs (fails on miss)
npm run validate:html    # local html-validate (fails on error)
npm run check:seo        # technical SEO / metadata (fails on gap)
npm test                 # includes SEO unit suite
npm run test:e2e         # includes seo.smoke.spec.js (Docker image in CI)
```

## Defects found and fixed

1. **OG/Twitter title drift** — `og:title` / `twitter:title` disagreed with `<title>` and with each other. Aligned both to the existing page title.
2. **OG/Twitter description drift** — social descriptions used different wording than `<meta name="description">`. Aligned both to the existing meta description (no new copy).
3. **Same-site href vs canonical** — in-page `https://meromhouse.org` links omitted the trailing slash used by the canonical URL. Normalized to `https://meromhouse.org/`.
4. **Manifest completeness** — added `lang`, `id`, and `scope` on `site.webmanifest` (icons/start_url already correct).
5. **SEO CI was report-only** — presence check used `continue-on-error: true` and did not cover canonical/OG/Twitter/robots/sitemap/headings/alts. Expanded the checker and made the CI step blocking; added Playwright smoke.

### Already correct (verified, unchanged wording)

- Single HTML document route (`/`) with unique title + meta description.
- Canonical `https://meromhouse.org/`, `og:url`, `og:image` (+ dimensions/type/alt).
- `robots.txt` (`Allow: /` + Sitemap line) and `sitemap.xml` (`/` only).
- Favicon / apple-touch / manifest link tags and `/public/*` assets.
- Heading hierarchy: one `h1`, six card `h2`s, research `h3` under research `h2`.
- Decorative footer OG preview: `alt=""` + `figure[aria-hidden="true"]`.
- No broken internal refs (`npm run check:links`).

## Out of scope

- Writing new marketing / grants / energy / nonprofit copy
- Live probing of third-party URLs
- Production deploy / merge
