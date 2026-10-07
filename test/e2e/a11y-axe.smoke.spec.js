import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockGitHubStats } from './helpers.js';

test.describe('axe-core on /', () => {
  test('has no link-in-text-block or region violations', async ({ page }) => {
    await mockGitHubStats(page);
    await page.goto('/');
    await expect(page.locator('#site-status')).toHaveText('online', {
      timeout: 10_000,
    });

    const results = await new AxeBuilder({ page })
      .withRules(['link-in-text-block', 'region'])
      .analyze();

    const byId = Object.fromEntries(
      results.violations.map((v) => [v.id, v]),
    );
    expect(byId['link-in-text-block'], JSON.stringify(byId['link-in-text-block'] || null)).toBeUndefined();
    expect(byId.region, JSON.stringify(byId.region || null)).toBeUndefined();
  });
});
