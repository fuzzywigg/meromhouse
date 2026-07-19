# Governance

## Operating Model

This repo is a public brand and proof-of-work asset. Changes should favor clarity, uptime, and accurate status over novelty.

## Agent Rules

- Keep public claims backed by live repos, deployments, or docs.
- Do not add secrets to prompts, docs, issues, commits, or logs.
- Prefer small, reviewable commits.
- Validate locally before deploys.
- Smoke test production after deploys.

## Infrastructure

- Hosting: Cloudflare Pages
- Project: `meromhouse`
- Functions: Cloudflare Pages Functions under `functions/api/`
- Custom domain: `meromhouse.org`

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-18 | `fuzzywigg/meromhouse` is canonical | It backs the production Cloudflare Pages dashboard. |
| 2026-07-18 | Retire `fuzzywigg/meromhouse.org` | The old Next app created repo/domain confusion and was not the active cutover source. |
