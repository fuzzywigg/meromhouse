import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DOCUMENT_ROUTES, mockGitHubStats } from './helpers.js';

test.describe('axe-core accessibility', () => {
  for (const route of DOCUMENT_ROUTES) {
    test(`${route} has no axe violations (wcag2a/aa + best-practice)`, async ({
      page,
    }) => {
      await mockGitHubStats(page);
      await page.goto(route);
      await expect(page.locator('#site-status')).toHaveText('online', {
        timeout: 10_000,
      });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
        .analyze();

      expect(
        results.violations,
        JSON.stringify(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.target),
          })),
          null,
          2,
        ),
      ).toEqual([]);
    });

    test(`${route} passes focused a11y rules (contrast, landmarks, headings, links, images)`, async ({
      page,
    }) => {
      await mockGitHubStats(page);
      await page.goto(route);
      await expect(page.locator('#site-status')).toHaveText('online', {
        timeout: 10_000,
      });

      const results = await new AxeBuilder({ page })
        .withRules([
          'link-in-text-block',
          'link-name',
          'region',
          'heading-order',
          'color-contrast',
          'image-alt',
          'bypass',
        ])
        .analyze();

      const byId = Object.fromEntries(
        results.violations.map((v) => [v.id, v]),
      );
      for (const id of [
        'link-in-text-block',
        'link-name',
        'region',
        'heading-order',
        'color-contrast',
        'image-alt',
        'bypass',
      ]) {
        expect(byId[id], JSON.stringify(byId[id] || null)).toBeUndefined();
      }
    });
  }
});
