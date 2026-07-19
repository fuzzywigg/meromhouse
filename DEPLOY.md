# DEPLOY.md — meromhouse.org

## Current Production State

Cloudflare Pages project `meromhouse` exists and serves this repo. A verified deployment is live at:

```text
https://8491053c.meromhouse.pages.dev
```

Smoke-tested paths:

- `/`
- `/api/health`
- `/og-image.jpg`

Remaining cutover work: ensure the custom domain `meromhouse.org` is attached to the `meromhouse` Pages project and no longer routes to the retired Next.js app.

## Historical One-time Setup

### 1. Create the GitHub repo

The GitHub repo already exists as `fuzzywigg/meromhouse`.

**Option A — GitHub UI (30 seconds):**
1. Go to https://github.com/new
2. Name: `meromhouse`
3. Description: `meromhouse.org — Andrew Pappas live KPI dashboard`
4. Public ✓ · Add a README ✓
5. Create repository

**Option B — Re-authorize the PAT:**
Add `repo` scope to the existing token at https://github.com/settings/tokens

---

### 2. Push this scaffold

```bash
cd /home/fuzzywigg/.openclaw/workspace/meromhouse-scaffold
git init
git remote add origin https://github.com/fuzzywigg/meromhouse.git
git add -A
git commit -m "feat: meromhouse.org scaffold — CF Pages KPI dashboard"
git push -u origin main
```

---

### 3. Connect to Cloudflare Pages

1. Go to [Cloudflare Pages](https://dash.cloudflare.com) → Workers & Pages → Create → Pages
2. **Connect to Git** → select `fuzzywigg/meromhouse`
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/` (or `.`)
4. Click **Save and Deploy**

---

### 4. Add or move custom domain

1. In CF Pages project `meromhouse` → **Custom domains** → Add domain → `meromhouse.org`
2. If DNS is already on Cloudflare: automatic CNAME added
3. If DNS is elsewhere: add `CNAME meromhouse.org → <project>.pages.dev`
4. If Cloudflare says the domain is already attached to another Pages project, remove it from the old project first, then add it here.

---

### 5. Optional: Raise GitHub API rate limits

Add env var in CF Pages → Settings → Environment variables:
- **Variable name:** `GITHUB_TOKEN`
- **Value:** your GitHub PAT (needs `public_repo` read scope only)

Without this: 60 req/hr (fine for v1 — dashboard caches for 1h)
With this: 5,000 req/hr

---

### 6. Optional: Add KV namespace

For caching GitHub API responses in Workers KV:
1. CF Dashboard → Workers & Pages → KV → Create namespace `meromhouse-cache`
2. In CF Pages project → Settings → Functions → KV namespace bindings
3. Add binding: **Variable name:** `KV` → **KV namespace:** `meromhouse-cache`

---

## Result

Live public KPI dashboard at `meromhouse.org`. GitHub stats refresh every 5 minutes (client-side) via `/api/github-stats` (CF Pages Function).

**Cost: $0** — CF Pages free tier includes static hosting + 500 Function invocations/day.
