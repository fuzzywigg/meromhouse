# Merge order — open PRs (Oct 7, 2026)

Snapshot of live branches as of **2026-10-07T14:33Z**.
Stack tip: `#40` / `cursor/link-deps-check-2dc2` @ `d29eba1` (33 commits ahead of `main` @ `1422842`).

This guide is advisory only. It does **not** merge, close, retarget, or push to any existing PR.

## Stack topology

```
main
 ├─ #18  dependabot/github_actions/…          (also folded into #30)
 ├─ #24  cursor/health-poll-visibility-docs-ea25   ← NOT in stack (superseded by #25)
 ├─ #25  … → folded into #30
 ├─ #26  … → folded into #30
 ├─ #27  … → folded into #30
 │    └─ #29  (base = #27)
 ├─ #28  … → folded into #30
 ├─ #30  integration #18+#25–#29 (skipped #24)
 │    └─ #32
 │         └─ #33
 │              └─ #34
 ├─ #31  (side) ─┐
 ├─ #35  (side) ─┼─→ folded into #38
 ├─ #36  (side) ─┘
 ├─ #38  integration #30–#34 + #31/#35/#36   (base = main)
 │    └─ #39  fold #37 into #38
 │         └─ #40  CI-only (link check, npm audit, SHA pins)  ← STACK TIP
 └─ #37  (side; folded into #39, not into #38 alone)
```

## Summary table

| PR | Title | Base | Contained in | Conflicts vs tip (#40) | CI | Recommendation |
|----|-------|------|--------------|------------------------|----|----------------|
| #18 | chore(deps): bump the github_actions group with 2 updates | `main` | **#30 → #38 → #39 → #40** (ancestor; tip pins same actions at v7 SHAs) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #24 | docs: note /api/health also pauses when the tab is hidden | `main` | **Intent only** — skipped by #30 in favor of #25; tip has equivalent README + `dashboard.js` pause tests | **yes** (`README.md`, `test/index-html.test.js`) | validate ✅ · Pages ✅ | **close-as-superseded** |
| #25 | Document health poll pause-when-hidden and close remaining a11y gaps | `main` | **#30 → … → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #26 | fix: harden /api/health and github-stats edge cases | `main` | **#30 → … → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #27 | test: Playwright smoke for refresh bar, health status, and a11y | `main` | **#30 → … → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #28 | fix: harden cache honesty (stale KV age + visibility poll races) | `main` | **#30 → … → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #29 | test: Playwright reduced-motion and noscript smokes | #27 branch | **#30 → … → #40** (ancestor) | none | Pages ✅ · validate n/a (base ≠ main) | **close-as-superseded** |
| #30 | integration: open PRs #24–#29 (Oct 7) | `main` | **#38 → #39 → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #31 | docs: quality audit snapshot 2026-10-07 (Lighthouse + axe) | `main` | **#38 → #39 → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #32 | fix(a11y): hub link underline/contrast + refresh-bar landmark | #30 branch | **#38 → #39 → #40** (ancestor) | none | Pages ✅ · validate n/a | **close-as-superseded** |
| #33 | fix(quality): P2 image, meta, cache, and poll scheduling | #32 branch | **#38 → #39 → #40** (ancestor) | none | Pages ✅ · validate n/a | **close-as-superseded** |
| #34 | test(e2e): Playwright visual regression for all routes × viewports | #33 branch | **#38 → #39 → #40** (ancestor) | none | Pages ✅ · validate n/a | **close-as-superseded** |
| #35 | test: technical QA gates (links, HTML validate, dashboard UI) | `main` | **#38 → #39 → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #36 | Security hardening: headers + 2026-10-07 audit (no deploy) | `main` | **#38 → #39 → #40** (ancestor) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #37 | perf: Lighthouse pass — images, deferred JS, font preload | `main` | **#39 → #40** (ancestor; **not** in #38 alone) | none | validate ✅ · Pages ✅ | **close-as-superseded** |
| #38 | integration: stack #30–#34 + #31/#35/#36 (Oct 7) | `main` | **#39 → #40** (ancestor) | none | **validate ❌** (wrangler Pages smoke) · Pages ✅ | **close-as-superseded** (do not merge; tip supersedes) |
| #39 | integration: fold #37 Lighthouse perf into stack (#38) | #38 branch | **#40** (ancestor) | none | Pages ✅ · validate n/a | **close-as-superseded** |
| #40 | ci: offline link checker, npm audit report-only, pin Actions SHAs | #39 branch | — (stack tip; clean merge-tree into `main`) | n/a | Pages ✅ · validate n/a (base ≠ main) | **merge** (after retarget → `main` + green validate) |

**Method notes**

- *Contained in* = `git merge-base --is-ancestor <pr-head> <integration-head>` **or** `git merge-tree --write-tree <tip> <pr-head>` yields an empty tree change (already present).
- *Conflicts vs tip* = `git merge-tree` of tip ← PR reports `changed in both`.
- CI `validate` only runs on PRs targeting `main` (see `.github/workflows/ci.yml`). Stacked PRs (#29, #32–#34, #39–#40) therefore show Pages only.

## Changes not present in any integration PR

**None that still matter.**

| Candidate | Finding |
|-----------|---------|
| **#24** | Only open PR whose head is **not** an ancestor of #30/#38/#39/#40. #30 explicitly skipped it as a strict subset of **#25**. Tip still documents health/GitHub pause-when-hidden and asserts the same behavior against `assets/dashboard.js` (script was later extracted from `index.html`). Exact #24 README phrasing differs, but there is **no unique lasting change** to recover. Merging #24 into tip would conflict and regress toward older inline-script tests. |
| All others (#18, #25–#40) | Fully contained in tip #40 (ancestor and/or empty merge-tree). |

## Recommended landing sequence (fewest merges)

Goal: land **all** Oct 7 agent work onto `main` in **one** merge.

1. **Retarget #40** so its base is `main` (today it targets #39’s branch). Do not merge #38/#39 separately.
2. **Wait for `validate` on #40** against `main`. Tip merges cleanly into `main` with no content conflicts (`git merge-tree` clean @ snapshot). Prefer a green run before merging — #38’s validate failed on the local wrangler Pages smoke step; that failure is superseded by later commits on #39/#40 but has not been re-proven on a `main`-targeted PR.
3. **Merge #40** into `main` (squash or merge commit — owner preference).
4. **Close as superseded** (in any order): #18, #24–#39.

### Why not merge the intermediates?

| Path | Merges to get everything | Drawback |
|------|--------------------------|----------|
| **#40 → main** (retarget) | **1** | Needs base change + fresh CI |
| #38 → main, then #39, then #40 | 3 | #38 validate is red; extra noise |
| #30 → main, then #32…#34, then side PRs, then #37… | many | All already inside #40; high conflict/churn risk |
| Merge leaf PRs (#25–#28, #31, #35–#37, …) individually | many | Duplicate work; #24 conflicts with evolved tip |

### After landing

- Confirm production smoke: `curl` `/`, `/api/health`, `/og-image.jpg` on `meromhouse.org` (per `AGENTS.md`) when you choose to deploy — this guide does not deploy.
- Optional: delete remote feature branches after close.

## Verification commands used

```bash
# ancestry
git merge-base --is-ancestor <pr-head> origin/cursor/link-deps-check-2dc2

# content already on tip?
git merge-tree --write-tree origin/cursor/link-deps-check-2dc2 <pr-head>
# empty tree vs tip ⇒ fully contained; conflict markers ⇒ conflicts

# tip vs main
git merge-tree $(git merge-base origin/main origin/cursor/link-deps-check-2dc2) \
  origin/main origin/cursor/link-deps-check-2dc2
```

CI conclusions from `gh pr list` / `gh run view` at snapshot time (see table).
