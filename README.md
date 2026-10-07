# meromhouse

[![CI](https://github.com/fuzzywigg/meromhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/fuzzywigg/meromhouse/actions/workflows/ci.yml)

> Andrew Pappas, building in public.

Canonical source for [meromhouse.org](https://meromhouse.org), Andrew Pappas's public KPI dashboard. Shows active projects, GitHub activity, research output, and deployment status.

## Cloud agents

Bootstrap lives in [`.cursor/environment.json`](.cursor/environment.json) (`install` verifies keeper files; `start` runs `wrangler pages dev` — no secrets in the file). PR CI is [`.github/workflows/ci.yml`](.github/workflows/ci.yml). DNS / custom-domain leftover cleanup stays HITL (issue #4). Deploy walkthrough: [DEPLOY.md](./DEPLOY.md).

## Repository Status

- Keeper repo: `fuzzywigg/meromhouse`
- Retired repo: `fuzzywigg/meromhouse.org`
- Production host: Cloudflare Pages project `meromhouse`
- Live production URL: `https://meromhouse.org`

The former `meromhouse.org` Next.js repo was folded into this repo on 2026-07-18. Durable governance notes, release process, favicon, and manifest assets were preserved here. Development should happen in this repo only.

## Stack

- Cloudflare Pages (hosting, zero cost)
- CF Pages Functions (github-stats API; optional KV cache when bound)
- Vanilla HTML/CSS/JS (zero dependencies, fast)

## Dashboard (live)

![meromhouse KPI dashboard](./docs/screenshots/meromhouse-home.png)

*Live capture from [meromhouse.pages.dev](https://meromhouse.pages.dev) (same Pages project as meromhouse.org).*

## How it works

```mermaid
flowchart LR
  Browser["Browser"] --> Index["index.html<br/>dashboard cards"]
  Index -->|"fetch /api/github-stats<br/>while the tab is visible"| GhFn["functions/api/github-stats.js"]
  GhFn -->|"valid KV JSON"| KV["KV cache"]
  GhFn -->|"miss, no KV, or invalid cache"| GH["GitHub API<br/>user, repo pages, events"]
  GH --> GhFn
  GhFn --> Index
  Index -->|"fetch /api/health"| Health["functions/api/health.js"]
  Health --> Index
  Index -.->|"static copy"| Static["Projects, research,<br/>writing, deployments"]
  Index -.->|"link, not a probe"| Hub["fuzzywigg.ai"]
```

## Data Sources

| Source | Status | Card |
|--------|--------|------|
| GitHub API via `/api/github-stats` | Live. `total_stars` follows repo `Link` pages (capped). `recent_commits` sums PushEvent `payload.size` in the fetched events window for this month, not a full history. The refresh bar shows `cached_at`, or "unavailable" if the fetch fails. | GitHub Activity |
| `/api/health` | Live same-origin fetch | Uptime: meromhouse.org (`online`, `degraded`, or `error`, with `updated`) |
| Not probed from the browser | Link only | Uptime: fuzzywigg.ai |
| Hardcoded in `index.html` | Static | Active Projects, REE Research |
| Hardcoded / manual edit | Static | Writing, Deployments |
| CF Analytics | Planned (not wired) | Page views |
| Google Search Console | Planned (not wired) | SEO impressions |
| X API | Planned (not wired) | Followers |
| YouTube API | Planned (not wired) | Subscribers |

GitHub Activity calls `/api/github-stats`. KV hits older than the one-hour TTL (by `cached_at`) are rejected and refetched. The client also treats an age-stale `cached_at` as unavailable. Both polls use a generation + `AbortController` gate so a visibility hide/show race does not paint a superseded response or flash unavailable on abort. The Uptime card calls `/api/health` for meromhouse.org and keeps a text state next to the dot. fuzzywigg.ai is a link, not a browser check. The other cards are copy in `index.html`.

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
├── docs/               # Governance, release, screenshots
├── .cursor/
│   └── environment.json # Cloud agent install/start (static + wrangler)
├── site.webmanifest    # PWA manifest (icons under /public/)
├── _headers            # CF Pages security headers
├── _redirects          # CF Pages redirects (no active rules; APIs under /api/*)
├── wrangler.toml       # Local dev config
├── DEPLOY.md           # Setup walkthrough
└── AGENTS.md           # Agent governance
```

## Part of the smtp.eth ecosystem

Built by Geryon 🦀 for [fuzzywigg](https://github.com/fuzzywigg).
