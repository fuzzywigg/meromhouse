# Merge order — open PRs (Oct 7, 2026)

Snapshot: **2026-10-07**. Tip branch: `cursor/integration-collapse-28-47-9501` (this PR).

Built from #47 (`cursor/integration-fold-45-onto-46-70c0`). Every open PR **#28–#47** (and earlier stack sources **#18**, **#24–#27**) was checked with `git merge-base --is-ancestor` and `git cherry`. Nothing new needed folding: all unique work is already in the tip, or is superseded docs that conflict only on `docs/MERGE-ORDER.md` / older README wording.

This guide does **not** merge, close, or retarget any PR.

## Status table

| PR | Title | Status | Recommendation |
|----|-------|--------|----------------|
| #18 | chore(deps): bump the github_actions group | Contained in tip | Close after tip merges |
| #24 | docs: note /api/health also pauses when the tab is hidden | Superseded (intent in #25+; older README patch conflicts) | Close after tip merges |
| #25 | Document health poll pause-when-hidden and a11y gaps | Contained in tip | Close after tip merges |
| #26 | fix: harden /api/health and github-stats edge cases | Contained in tip | Close after tip merges |
| #27 | test: Playwright smoke for refresh bar, health, a11y | Contained in tip | Close after tip merges |
| #28 | fix: harden cache honesty (stale KV age + visibility races) | Contained in tip | Close after tip merges |
| #29 | test: Playwright reduced-motion and noscript smokes | Contained in tip | Close after tip merges |
| #30 | integration: open PRs #24–#29 (Oct 7) | Contained in tip | Close after tip merges |
| #31 | docs: quality audit snapshot 2026-10-07 | Contained in tip | Close after tip merges |
| #32 | fix(a11y): hub link underline/contrast + refresh-bar landmark | Contained in tip | Close after tip merges |
| #33 | fix(quality): P2 image, meta, cache, and poll scheduling | Contained in tip | Close after tip merges |
| #34 | test(e2e): Playwright visual regression | Contained in tip | Close after tip merges |
| #35 | test: technical QA gates | Contained in tip | Close after tip merges |
| #36 | Security hardening: headers + audit (no deploy) | Contained in tip | Close after tip merges |
| #37 | perf: Lighthouse pass | Contained in tip | Close after tip merges |
| #38 | integration: stack #30–#34 + #31/#35/#36 | Contained in tip | Close after tip merges |
| #39 | integration: fold #37 into #38 | Contained in tip | Close after tip merges |
| #40 | ci: offline link checker, npm audit, pin Actions SHAs | Contained in tip | Close after tip merges |
| #41 | docs: merge-order guide for open draft PRs | Superseded (MERGE-ORDER rewritten on tip) | Close after tip merges |
| #42 | fix(a11y): Playwright axe/LH audit, decorative figure | Contained in tip | Close after tip merges |
| #43 | Integration: fold #40 #41 #42 onto #39 | Contained in tip | Close after tip merges |
| #44 | ci: HTML validate + report-only SEO presence | Contained in tip | Close after tip merges |
| #45 | test: Playwright viewport smoke + report-only security headers | Contained in tip (cherry-picked onto #46) | Close after tip merges |
| #46 | Integration: fold #44 onto #43 | Contained in tip | Close after tip merges |
| #47 | Integration: fold #45 onto #46 | Contained in tip (prior tip) | Close after tip merges |
| **This PR** | Integration: collapse #28–#47 into one tip | Stack tip | **Review and merge this PR** |

## Not folded (and why)

| PR | Why not folded |
|----|----------------|
| #24 | Not a git ancestor. Its README/`index-html` test patch conflicts with the evolved tip. Intent already landed via #25 and later docs/tests. Resolving the conflict would only rewrite superseded wording — left alone. |
| #41 | Not a git ancestor. Only touches `docs/MERGE-ORDER.md`, which this tip already owns and rewrites. |

No other open PR in **#28–#47** had commits or patches missing from the tip. No site-copy conflicts about grants, the data center, energy park, or nonprofit plans.

## Single recommendation

**Review and merge this tip PR** (base `main`), then **close these:** #18, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47.

Do not merge the intermediates. One merge into `main` is enough.
