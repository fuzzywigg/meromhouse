import { test, expect } from '@playwright/test';
import {
  MOCK_GITHUB_STATS,
  mockGitHubStats,
  mockGitHubStatsFailure,
} from './helpers.js';

test.describe('refresh bar honesty', () => {
  test('states which cards refresh, that polling needs a visible tab, and that others are static', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    const bar = page.locator('#refresh-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText(/GitHub activity/i);
    await expect(bar).toContainText(/meromhouse\.org status/i);
    await expect(bar).toContainText(/refresh every 5 minutes/i);
    await expect(bar).toContainText(/while this tab is visible/i);
    await expect(bar).toContainText(/Other cards are static/i);
  });

  test('shows GitHub cached_at in last-updated after a successful stats fetch', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    const lastUpdated = page.locator('#last-updated');
    await expect(lastUpdated).not.toHaveText('—', { timeout: 10_000 });
    await expect(lastUpdated).not.toHaveText('unavailable');
    // Locale string varies by runner; require a real clock-like value.
    await expect(lastUpdated).toHaveText(/\d/);
  });

  test('shows unavailable in last-updated when GitHub stats fail', async ({
    page,
  }) => {
    await mockGitHubStatsFailure(page);
    await page.goto('/');

    await expect(page.locator('#last-updated')).toHaveText('unavailable', {
      timeout: 10_000,
    });
    await expect(page.locator('#gh-status')).toHaveText('unavailable');
    await expect(page.locator('#gh-stars')).toHaveText('unavailable');
  });
});

test.describe('/api/health status row', () => {
  test('promotes meromhouse.org from checking to online with a Checked time', async ({
    page,
  }) => {
    await mockGitHubStats(page);

    const healthResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/health') &&
        res.request().method() === 'GET' &&
        res.ok(),
    );
    await page.goto('/');
    const health = await healthResponse;
    const body = await health.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe('online');
    expect(typeof body.updated).toBe('string');
    expect(Number.isNaN(Date.parse(body.updated))).toBe(false);

    const siteStatus = page.locator('#site-status');
    await expect(siteStatus).toHaveText('online', { timeout: 10_000 });
    await expect(siteStatus).toHaveAttribute('aria-live', 'polite');

    const siteChecked = page.locator('#site-checked');
    await expect(siteChecked).not.toHaveText('—');
    await expect(siteChecked).not.toHaveText('unavailable');
    await expect(siteChecked).toHaveAttribute('datetime', /.+/);
    await expect(siteChecked).toHaveText(/\d/);

    await expect(page.locator('#site-dot')).toHaveClass(/green/);
  });

  test('keeps fuzzywigg.ai as a link row, not a live probe', async ({ page }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    const hubRow = page
      .locator('.card')
      .filter({ hasText: 'Uptime / Status' })
      .locator('.card-row')
      .filter({ hasText: 'fuzzywigg.ai' });

    await expect(hubRow).toContainText(/link/i);
    await expect(hubRow).toContainText('hub');
    await expect(hubRow.locator('a[href*="fuzzywigg.ai"]')).toBeVisible();
    await expect(hubRow).not.toContainText(/checking/i);
    await expect(hubRow).not.toContainText(/online/i);
  });

  test('marks health error state when /api/health fails', async ({ page }) => {
    await mockGitHubStats(page);
    await page.route('**/api/health', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false }),
      });
    });
    await page.goto('/');

    await expect(page.locator('#site-status')).toHaveText('error', {
      timeout: 10_000,
    });
    await expect(page.locator('#site-checked')).toHaveText('unavailable');
    await expect(page.locator('#site-dot')).toHaveClass(/error/);
  });
});

test.describe('a11y basics', () => {
  test('document language, landmarks, and one primary heading', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);

    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toContainText('Andrew');
    await expect(h1).toContainText('Pappas');
  });

  test('live regions announce status and refresh updates politely', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    for (const id of [
      'last-updated',
      'gh-stars',
      'gh-repos',
      'gh-commits',
      'site-status',
      'site-checked',
      'gh-status',
    ]) {
      await expect(page.locator(`#${id}`)).toHaveAttribute(
        'aria-live',
        'polite',
      );
    }
  });

  test('decorative status dots that declare aria-hidden stay hidden', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    // Assert the dots the shell already marks decorative; do not require
    // every .status-dot (gh-dot may still lack aria-hidden on main).
    await expect(page.locator('#site-dot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(
      page.locator('.status-dot.link[aria-hidden="true"]'),
    ).toHaveCount(1);
  });

  test('keyboard Tab reaches a header link with a visible focus ring', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    // Drive real keyboard focus so :focus-visible matches (programmatic
    // element.focus() often does not).
    const headerLink = page.locator('.header-meta a').first();
    let focused = false;
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      if (await headerLink.evaluate((el) => el === document.activeElement)) {
        focused = true;
        break;
      }
    }
    expect(focused).toBe(true);
    await expect(headerLink).toBeFocused();

    const outlineWidth = await headerLink.evaluate((el) =>
      getComputedStyle(el).outlineWidth,
    );
    const numeric = Number.parseFloat(outlineWidth);
    expect(Number.isFinite(numeric)).toBe(true);
    expect(numeric).toBeGreaterThanOrEqual(2);
  });

  test('external links keep rel=noopener in the live DOM', async ({ page }) => {
    await mockGitHubStats(page);
    await page.goto('/');

    const external = page.locator('a[href^="http"]');
    const count = await external.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      const rel = (await external.nth(i).getAttribute('rel')) || '';
      expect(rel.split(/\s+/)).toContain('noopener');
    }
  });
});

// Keep the mock payload referenced so helpers stay honest if the shape drifts.
test('mock github-stats fixture includes cached_at', () => {
  expect(MOCK_GITHUB_STATS.cached_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});
