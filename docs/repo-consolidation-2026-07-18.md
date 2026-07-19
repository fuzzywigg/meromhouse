# Meromhouse Repo Consolidation — 2026-07-18

## Decision

Keep `fuzzywigg/meromhouse` as the production repo. Retire `fuzzywigg/meromhouse.org`.

## Rationale

- `fuzzywigg/meromhouse` is tied to the active Cloudflare Pages project `meromhouse`.
- The Pages deployment `8491053c-55cb-4cdc-ba8e-36c1e4a3772d` has been verified for `/`, `/api/health`, and `/og-image.jpg`.
- The old `meromhouse.org` repo is a separate Next.js mission-control track that is confusing development and is not the current production cutover source.

## Preserved From `meromhouse.org`

- Mission-control framing for future roadmap language.
- Favicon and web manifest assets.
- MIT license.
- PR template, Dependabot config, and lightweight CI structure.
- Governance and release-process notes, adapted to the current static Cloudflare Pages stack.

## Not Preserved

- The Next.js runtime, Tailwind setup, generated `out/`, and `node_modules`.
- Stale autonomy rules that conflict with current OpenClaw standing authority.
- Placeholder operational links that are not production-backed.

## Follow-up

- Confirm `https://meromhouse.org` routes to Cloudflare Pages project `meromhouse`.
- Delete or archive the retired GitHub repo after this consolidation commit is pushed and verified.
