# Merge order — open PRs (Oct 7, 2026)

Snapshot of live branches as of **2026-10-07T15:30Z**.
Stack tip: `cursor/integration-fold-40-41-42-1bd6` (folds **#40 + #41 + #42** onto **#39**).

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
 │         └─ #40  CI link check + npm audit + SHA pins
 │              └─ #42  a11y audit + safe fixes (base = #40)
 │                   └─ THIS PR  fold #40+#41+#42 onto #39  ← STACK TIP
 ├─ #37  (side; folded into #39, not into #38 alone)
 └─ #41  docs-only MERGE-ORDER (base = main; content refreshed in THIS PR)
```

## Containment vs this tip

| Source PR | Relation to tip | Action in this fold |
|-----------|-----------------|---------------------|
| **#39** | Base of this PR (ancestor) | Stacked on; left open |
| **#40** | Ancestor of tip (via #42 FF) | Superseded by tip; no duplicate apply |
| **#41** | Docs-only on `main`; not an ancestor | `docs/MERGE-ORDER.md` brought in and **rewritten** for this tip |
| **#42** | Tip of a11y stack; FF onto #39 | Superseded by tip; includes all of #40 |

**No duplicate work:** #40 is fully contained in #42 (`git merge-base --is-ancestor` of #40 head in #42 head). Folding #42 onto #39 is a clean fast-forward of three commits (#40×2 + #42×1). #41 is not contained in #39/#40/#42; only its doc file is unique.

## Conflict resolutions

| Area | Resolution |
|------|------------|
| #40 / #42 onto #39 | **Fast-forward** — #39 head is an ancestor of #42; no content conflicts |
| #41 `docs/MERGE-ORDER.md` | **No file conflict** (new on tip). Replaced #41’s tip-=#40 narrative with tip=this integration PR; kept topology/table intent |
| Site copy / grants / Sullivan / nonprofit | **Unchanged** — hygiene, a11y markup, CI, and docs only |

## Summary table

| PR | Title | Base | Contained in tip? | Conflicts vs tip | Recommendation |
|----|-------|------|-------------------|------------------|----------------|
| #18 | chore(deps): bump the github_actions group | `main` | yes (ancestor via #30…#42) | none | **close-as-superseded** |
| #24 | docs: note /api/health also pauses when the tab is hidden | `main` | intent only (skipped by #30; #25) | yes vs old tip | **close-as-superseded** |
| #25–#29 | a11y / health / Playwright stack | varies | yes | none | **close-as-superseded** |
| #30 | integration #24–#29 (Oct 7) | `main` | yes | none | **close-as-superseded** |
| #31–#36 | QA / a11y / security side PRs | varies | yes (via #38…) | none | **close-as-superseded** |
| #37 | perf: Lighthouse pass | `main` | yes (via #39) | none | **close-as-superseded** |
| #38 | integration stack #30–#34 + sides | `main` | yes (via #39) | none | **close-as-superseded** |
| #39 | integration: fold #37 into #38 | #38 | yes (base / ancestor) | n/a | leave open until tip lands; then **close-as-superseded** |
| #40 | ci: offline link checker, npm audit, pin Actions SHAs | #39 | **yes** (ancestor of tip) | none | **close-as-superseded** (do not merge separately) |
| #41 | docs: merge-order guide for open draft PRs | `main` | **content yes** (refreshed file on tip) | none | **close-as-superseded** |
| #42 | fix(a11y): Playwright axe/LH audit, decorative figure | #40 | **yes** (ancestor of tip) | none | **close-as-superseded** |
| **THIS PR** | integration: fold #40+#41+#42 onto #39 | #39 | — (stack tip) | n/a | **merge** after retarget → `main` + green `validate` |

**Method notes**

- *Contained in tip* = `git merge-base --is-ancestor <pr-head> <tip-head>` **or** empty `git merge-tree --write-tree <tip> <pr-head>`.
- CI `validate` only runs on PRs targeting `main`. Stacked PRs therefore show Pages only until retargeted.

## Recommended landing sequence (fewest merges)

Goal: land Oct 7 agent work onto `main` in **one** merge.

1. **Retarget this integration PR** so its base is `main` (today it targets #39’s branch). Do not merge #38–#42 separately.
2. **Wait for green `validate`** against `main`.
3. **Merge this tip** into `main` (squash or merge commit — owner preference).
4. **Close as superseded** (in any order): #18, #24–#42 (including #39–#41 sources left open by prior agents).

### Why not merge the intermediates?

| Path | Merges | Drawback |
|------|--------|----------|
| **This tip → main** (retarget) | **1** | Needs base change + fresh CI |
| #39 → main, then #40, then #42, then #41 | 4 | Extra noise; #41’s guide would be stale |
| Merge leaf PRs individually | many | Duplicate work; #24 still conflicts with evolved tip |

### After landing

- Confirm production smoke: `curl` `/`, `/api/health`, `/og-image.jpg` on `meromhouse.org` (per `AGENTS.md`) when you choose to deploy — this guide does not deploy.
- Optional: delete remote feature branches after close.

## Verification commands used

```bash
# ancestry
git merge-base --is-ancestor origin/cursor/link-deps-check-2dc2 <tip>   # #40
git merge-base --is-ancestor origin/cursor/a11y-audit-fixes-bd52 <tip>  # #42

# #40 ⊂ #42
git merge-base --is-ancestor origin/cursor/link-deps-check-2dc2 \
  origin/cursor/a11y-audit-fixes-bd52

# tip vs main (after retarget)
git merge-tree $(git merge-base origin/main <tip>) origin/main <tip>
```
