# meromhouse

> Andrew Pappas, building in public.

Canonical source for [meromhouse.org](https://meromhouse.org), Andrew Pappas's public KPI dashboard. Shows real-time data on active projects, GitHub activity, research output, and deployment status.

## Repository Status

- Keeper repo: `fuzzywigg/meromhouse`
- Retired repo: `fuzzywigg/meromhouse.org`
- Production host: Cloudflare Pages project `meromhouse`
- Live deployment: `https://8491053c.meromhouse.pages.dev`

The former `meromhouse.org` Next.js repo was folded into this repo on 2026-07-18. Durable governance notes, release process, favicon, and manifest assets were preserved here. Development should happen in this repo only.

## Stack

- Cloudflare Pages (hosting, zero cost)
- CF Pages Functions (github-stats API, auto-cached)
- Vanilla HTML/CSS/JS (zero dependencies, fast)

## Data Sources

| Source | Status | Card |
|--------|--------|------|
| GitHub API | Live | GitHub Activity |
| Hardcoded | Live | Active Projects, REE Research |
| Manual update | Live | Writing, Deployments |
| CF Analytics | Planned | Page views |
| Google Search Console | Planned | SEO impressions |
| X API | Planned | Followers |
| YouTube API | Planned | Subscribers |

## Deploy

See [DEPLOY.md](./DEPLOY.md) for the full setup walkthrough.

## File Structure

```
meromhouse/
├── index.html          # Dashboard shell (dark theme, 6 data cards)
├── functions/api/
│   ├── github-stats.js # CF Pages Function — GitHub data aggregator
│   └── health.js       # CF Pages Function — health check
├── public/             # Favicon assets retained from retired Next app
├── docs/               # Governance, release, and consolidation notes
├── _headers            # CF Pages security headers
├── _redirects          # CF Pages URL rewrites
├── wrangler.toml       # Local dev config
├── DEPLOY.md           # Setup walkthrough
└── AGENTS.md           # Agent governance
```

## Part of the smtp.eth ecosystem

Built by Geryon 🦀 for [fuzzywigg](https://github.com/fuzzywigg).
