# AGENTS.md — meromhouse

parent_governance: github.com/fuzzywigg/agents-governance

## Classification
- Tier: A (Active Strategic — public brand asset)
- Autonomy: L2 (Autonomous with verification)
- Stack: Static HTML, CF Pages, CF Pages Functions
- Production repo: `fuzzywigg/meromhouse`
- Retired repo: `fuzzywigg/meromhouse.org`

## Purpose
Andrew's public KPI dashboard at meromhouse.org. Real-time view of active projects, research, and deployment status. Target: employers, collaborators, funders.

## Canonical Source
`fuzzywigg/meromhouse` is the only active source for the production Cloudflare Pages project `meromhouse`. The old `fuzzywigg/meromhouse.org` Next.js mission-control repo was consolidated into this repo on 2026-07-18 and must not be used for new work.

## Safe Agent Actions
- Update project status badges in index.html
- Add new data cards
- Improve the github-stats API response shape
- Update hardcoded counts (deploy count, project list)
- Update DEPLOY.md
- Update docs and CI workflows after local validation
- Deploy to Cloudflare Pages when credentials are present and smoke tests pass

## Escalate to Human
- Adding new external API credentials to CF environment
- Deleting production assets, domains, or repos
- Publishing external statements as Andrew

## Verification
Before reporting done:
- `npx wrangler pages dev . --port <free-port>` or static HTML smoke check
- `curl` `/`, `/api/health`, and `/og-image.jpg` after deployment
- Confirm `meromhouse.org` serves this dashboard, not the retired Next app
