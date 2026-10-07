/** Fixed GitHub stats payload so browser smoke never depends on api.github.com. */
export const MOCK_GITHUB_STATS = {
  public_repos: 20,
  followers: 14,
  total_stars: 3,
  recent_commits: 1,
  top_repos: [],
  cached_at: '2026-01-15T12:00:00.000Z',
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
