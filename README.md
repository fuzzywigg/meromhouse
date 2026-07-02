# meromhouse.org

> Andrew Pappas, building in public.

Live KPI dashboard at [meromhouse.org](https://meromhouse.org). Shows real-time data on active projects, GitHub activity, research output, and deployment status.

## Stack

- Cloudflare Pages (hosting, zero cost)
- CF Pages Functions (github-stats API, auto-cached)
- Vanilla HTML/CSS/JS (zero dependencies, fast)

## Data Sources

| Source | Status | Card |
|--------|--------|------|
| GitHub API | ✅ Live | GitHub Activity |
| Hardcoded | ✅ | Active Projects, REE Research |
| Manual update | ✅ | Writing, Deployments |
| CF Analytics | 🔜 V2 | Page views |
| Google Search Console | 🔜 V2 | SEO impressions |
| X API | 🔜 V2 | Followers |
| YouTube API | 🔜 V2 | Subscribers |

## Deploy

See [DEPLOY.md](./DEPLOY.md) for the full setup walkthrough.

## File Structure

```
meromhouse/
├── index.html          # Dashboard shell (dark theme, 6 data cards)
├── api/
│   ├── github-stats.js # CF Pages Function — GitHub data aggregator
│   └── health.js       # CF Pages Function — health check
├── _headers            # CF Pages security headers
├── _redirects          # CF Pages URL rewrites
├── wrangler.toml       # Local dev config
├── DEPLOY.md           # Setup walkthrough
└── AGENTS.md           # Agent governance
```

## Part of the smtp.eth ecosystem

Built by Geryon 🦀 for [fuzzywigg](https://github.com/fuzzywigg).
