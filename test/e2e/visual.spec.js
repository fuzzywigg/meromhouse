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
      viewport: { width: viewport.width, height: viewport.height },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'dark',
      deviceScaleFactor: 1,
      hasTouch: viewportName === 'mobile',
      isMobile: viewportName === 'mobile',
    });

    for (const route of DOCUMENT_ROUTES) {
      test(`${route} @ ${viewportName}`, async ({ page }) => {
        await installVisualClock(page);
        await mockApisForVisual(page);
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });

        await page.goto(route);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        // Self-hosted Source Sans 3 must win over system fallbacks for full-page height.
        await expect
          .poll(() =>
            page.evaluate(() => document.fonts.check('15px "Source Sans 3"')),
          )
          .toBe(true);

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
            caret: 'hide',
            scale: 'css',
          },
        );
      });
    }
  });
}
