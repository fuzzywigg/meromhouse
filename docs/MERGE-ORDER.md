# Merge order — open PRs (Oct 7, 2026)

Snapshot: **2026-10-07**. Tip: **integration fold of #52 onto #51** (`cursor/integration-fold-52-onto-51-c333`) against `main`.

Built by fast-forwarding `cursor/ci-visual-baselines-1f18` (#52) onto `cursor/integration-fold-49-50-onto-48-ec99` (#51). #52 was already rooted on the #51 tip; no content conflicts. Every open PR **#18**, **#24–#52** is contained in or superseded by this tip.

This guide does **not** merge, close, or retarget any PR.

## Playwright e2e count note (23 → 22)

| Tip | Reported e2e | Why |
|-----|-------------:|-----|
| **#48** | **23** / 23 | Two hard-fail axe tests per `DOCUMENT_ROUTES` (`/`): tag scan + focused-rules scan. |
| **#49** | **22** / 22 | Those two tests were **intentionally merged** into one report-only axe scan that still covers every public HTML route and writes `test-results/a11y/*`. No route coverage was dropped; no test was skipped or renamed away. |
| **#50** / **#51** | **22** / 22 | Same suite as #49; adds report-only Lighthouse via `npm run check:perf` (not a Playwright test). |
| **#52** / this tip | **22** / 22 | Same suite; `npm run test:e2e` runs inside the lockfile-matched Playwright Docker image so visual baselines match GitHub Actions. |

No unintentional loss — do **not** restore the hard-fail axe pair. Keep axe and Lighthouse **report-only** (`continue-on-error: true`); never make them blocking.

## Conflicts resolved

| Merge | Result |
|-------|--------|
| #49 onto #48 | Clean — no conflicts |
| #50 onto #48+#49 | Clean — no conflicts |
| #52 onto #51 | Clean — **fast-forward** (`1273560..ea4b907`); #52 had no unique tip commits behind #51 |

Report-only CI behavior retained from prior folds (axe summary, Lighthouse `check:perf`, security-headers Worker check, SEO presence, npm audit). Visual CI now uses Docker-authored baselines (`scripts/playwright-docker.sh`).

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
| #45 | test: Playwright viewport smoke + report-only security headers | Contained in tip | Close after tip merges |
| #46 | Integration: fold #44 onto #43 | Contained in tip | Close after tip merges |
| #47 | Integration: fold #45 onto #46 | Contained in tip | Close after tip merges |
| #48 | Integration: collapse #28–#47 into one tip | Contained in tip (prior integration tip) | Close after tip merges |
| #49 | fix(a11y): report-only axe CI + structural polish | Contained in tip (folded) | Close after tip merges |
| #50 | Verify + performance pass (report-only LH) | Contained in tip (folded) | Close after tip merges |
| #51 | Integration: fold #49 #50 onto #48 | Contained in tip (prior tip) | Close after tip merges |
| #52 | ci: green validate via Playwright Docker visual baselines | Contained in tip (folded) | Close after tip merges |
| **this tip** | Integration: fold #52 onto #51 | Stack tip vs `main` | **Review and merge this tip** |

## Not folded (and why)

| PR | Why not folded |
|----|----------------|
| #24 | Not a git ancestor. Its README/`index-html` test patch conflicts with the evolved tip. Intent already landed via #25 and later docs/tests. Resolving the conflict would only rewrite superseded wording — left alone. |
| #41 | Not a git ancestor. Only touches `docs/MERGE-ORDER.md`, which this tip already owns and rewrites. |

No site-copy conflicts about grants, the data center, energy park, or nonprofit plans.

## Single recommendation

**Review and merge this tip** (`cursor/integration-fold-52-onto-51-c333`) into `main`, then **close these:** #18, #24, #25, #26, #27, #28, #29, #30, #31, #32, #33, #34, #35, #36, #37, #38, #39, #40, #41, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51, #52.

Contained in the tip: **#18**, **#25–#40**, **#42–#52**. Superseded only (not git-ancestors): **#24**, **#41**.

Do not merge the intermediates. One merge of this tip into `main` is enough.
