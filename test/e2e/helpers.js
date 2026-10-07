/** Fixed GitHub stats payload so browser smoke never depends on api.github.com. */
export const MOCK_GITHUB_STATS = {
  public_repos: 20,
  followers: 14,
  total_stars: 3,
  recent_commits: 1,
  top_repos: [],
  // Fresh relative to STATS_MAX_AGE_MS / isFreshCachedAt (one-hour client gate from #28).
  cached_at: new Date().toISOString(),
};

/** Frozen instant for visual baselines (clock + API timestamps stay aligned). */
export const VISUAL_FIXED_TIME = '2026-04-15T15:30:00.000Z';

/** Document routes that render HTML (sitemap: / only). */
export const DOCUMENT_ROUTES = ['/'];

export const VISUAL_VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
};

/** Deterministic github-stats body paired with VISUAL_FIXED_TIME / page.clock. */
export const VISUAL_MOCK_GITHUB_STATS = {
  public_repos: 20,
  followers: 14,
  total_stars: 3,
  recent_commits: 1,
  top_repos: [],
  cached_at: VISUAL_FIXED_TIME,
};

/** Deterministic /api/health body so Checked timestamps do not drift. */
export const VISUAL_MOCK_HEALTH = {
  ok: true,
  status: 'online',
  version: '0.1.0',
  updated: VISUAL_FIXED_TIME,
  checks: { function: 'ok', kv: 'unbound' },
};

/**
 * Stub only /api/github-stats. Leave /api/health on the real Pages Function
 * so the smoke also proves the local function responds through the browser.
 */
export async function mockGitHubStats(page, body = MOCK_GITHUB_STATS) {
  await page.route('**/api/github-stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

export async function mockGitHubStatsFailure(page) {
  await page.route('**/api/github-stats', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'upstream' }),
    });
  });
}

export async function mockHealth(page, body = VISUAL_MOCK_HEALTH) {
  await page.route('**/api/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Mock both live APIs with frozen payloads for screenshot determinism. */
export async function mockApisForVisual(page) {
  await mockGitHubStats(page, VISUAL_MOCK_GITHUB_STATS);
  await mockHealth(page, VISUAL_MOCK_HEALTH);
}

/** Install Playwright clock before navigation so Date.now / toLocaleString match mocks. */
export async function installVisualClock(page) {
  await page.clock.install({ time: new Date(VISUAL_FIXED_TIME) });
}
