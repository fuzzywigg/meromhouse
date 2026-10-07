/**
 * Built-site smoke at desktop + phone viewports.
 * Engineering checks only: load, console errors, horizontal overflow,
 * and intrinsic image dimensions (CLS guard). No copy assertions.
 */
import { test, expect } from '@playwright/test';
import {
  DOCUMENT_ROUTES,
  VISUAL_VIEWPORTS,
  mockGitHubStats,
} from './helpers.js';

const SMOKE_VIEWPORTS = {
  phone: VISUAL_VIEWPORTS.mobile,
  desktop: VISUAL_VIEWPORTS.desktop,
};

/** Console noise that is not a page/script failure (network flakes, CSP-RO). */
function isIgnorableConsoleText(text) {
  const t = String(text);
  if (/\[Report Only\]/i.test(t)) return true;
  if (/Content Security Policy/i.test(t) && /report.?only/i.test(t)) return true;
  // Favicon / optional asset 404s should not fail layout smoke.
  if (/Failed to load resource/i.test(t) && /favicon/i.test(t)) return true;
  return false;
}

function attachConsoleGuards(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isIgnorableConsoleText(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
      clientWidth: doc.clientWidth,
    };
  });
  // 1px tolerance for subpixel scrollWidth on some engines.
  expect(
    metrics.scrollWidth,
    `horizontal overflow: scrollWidth=${metrics.scrollWidth} clientWidth=${metrics.clientWidth}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function assertImagesHaveDimensions(page) {
  const images = page.locator('img');
  const count = await images.count();
  expect(count, 'expected at least one <img> on the dashboard').toBeGreaterThan(
    0,
  );

  for (let i = 0; i < count; i += 1) {
    const img = images.nth(i);
    const widthAttr = await img.getAttribute('width');
    const heightAttr = await img.getAttribute('height');
    expect(
      widthAttr,
      `img[${i}] missing width attribute (CLS risk)`,
    ).toBeTruthy();
    expect(
      heightAttr,
      `img[${i}] missing height attribute (CLS risk)`,
    ).toBeTruthy();

    const width = Number.parseFloat(widthAttr);
    const height = Number.parseFloat(heightAttr);
    expect(Number.isFinite(width) && width > 0, `img[${i}] width`).toBe(true);
    expect(Number.isFinite(height) && height > 0, `img[${i}] height`).toBe(
      true,
    );
  }
}

for (const [viewportName, viewport] of Object.entries(SMOKE_VIEWPORTS)) {
  test.describe(`viewport layout smoke · ${viewportName}`, () => {
    test.use({ viewport });

    for (const route of DOCUMENT_ROUTES) {
      test(`${route} loads cleanly @ ${viewportName}`, async ({ page }) => {
        await mockGitHubStats(page);
        const consoleErrors = attachConsoleGuards(page);

        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        expect(response, 'navigation response').toBeTruthy();
        expect(response.ok(), `HTTP ${response.status()} for ${route}`).toBe(
          true,
        );

        await expect(page.locator('main')).toBeVisible();
        await expect(page.locator('h1')).toBeVisible();

        // Wait for live status paint so layout is settled before overflow check.
        await expect(page.locator('#site-status')).toHaveText(/online|error/, {
          timeout: 10_000,
        });

        await assertNoHorizontalOverflow(page);
        await assertImagesHaveDimensions(page);

        expect(
          consoleErrors,
          `unexpected console/page errors @ ${viewportName}:\n${consoleErrors.join('\n')}`,
        ).toEqual([]);
      });
    }
  });
}
