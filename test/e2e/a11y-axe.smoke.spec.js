import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockGitHubStats } from './helpers.js';

test.describe('axe-core on /', () => {
  test('has no link-in-text-block, region, heading-order, or color-contrast violations', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.goto('/');
    await expect(page.locator('#site-status')).toHaveText('online', {
      timeout: 10_000,
    });

    const results = await new AxeBuilder({ page })
      .withRules([
        'link-in-text-block',
        'region',
        'heading-order',
        'color-contrast',
      ])
      .analyze();

    const byId = Object.fromEntries(
      results.violations.map((v) => [v.id, v]),
    );
    for (const id of [
      'link-in-text-block',
      'region',
      'heading-order',
      'color-contrast',
    ]) {
      expect(byId[id], JSON.stringify(byId[id] || null)).toBeUndefined();
    }
  });
});
