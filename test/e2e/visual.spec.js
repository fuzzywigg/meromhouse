import { test, expect } from '@playwright/test';
import {
  DOCUMENT_ROUTES,
  VISUAL_VIEWPORTS,
  installVisualClock,
  mockApisForVisual,
} from './helpers.js';

function routeSlug(route) {
  if (route === '/') return 'home';
  return route.replace(/^\//, '').replace(/\//g, '-') || 'home';
}

for (const [viewportName, viewport] of Object.entries(VISUAL_VIEWPORTS)) {
  test.describe(`visual regression · ${viewportName}`, () => {
    test.use({
      viewport,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'dark',
    });

    for (const route of DOCUMENT_ROUTES) {
      test(`${route} @ ${viewportName}`, async ({ page }) => {
        await installVisualClock(page);
        await mockApisForVisual(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('#site-status')).toHaveText('online', {
          timeout: 10_000,
        });
        await expect(page.locator('#gh-status')).toHaveText('ok', {
          timeout: 10_000,
        });
        await expect(page.locator('#last-updated')).not.toHaveText('—');
        await expect(page.locator('#last-updated')).not.toHaveText('unavailable');

        await expect(page).toHaveScreenshot(
          `${routeSlug(route)}-${viewportName}.png`,
          {
            fullPage: true,
            animations: 'disabled',
          },
        );
      });
    }
  });
}
