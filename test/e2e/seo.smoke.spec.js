/**
 * Live-document technical SEO smoke (blocking).
 * Presence / consistency / asset reachability only — no copy invention.
 */
import { test, expect } from '@playwright/test';
import { DOCUMENT_ROUTES, mockGitHubStats } from './helpers.js';

const SITE_ORIGIN = 'https://meromhouse.org';

function metaContent(page, selector) {
  return page.locator(selector).first().getAttribute('content');
}

test.describe('technical SEO / metadata', () => {
  for (const route of DOCUMENT_ROUTES) {
    test(`${route} has title, description, canonical, OG/Twitter, headings, img alts`, async ({
      page,
    }) => {
      await mockGitHubStats(page);
      await page.goto(route);

      const title = (await page.title()).trim();
      expect(title.length).toBeGreaterThan(0);

      const description = (
        (await metaContent(page, 'meta[name="description"]')) || ''
      ).trim();
      expect(description.length).toBeGreaterThan(0);

      const canonical = await page
        .locator('link[rel="canonical"]')
        .first()
        .getAttribute('href');
      expect(canonical).toBe(`${SITE_ORIGIN}/`);

      await expect(page.locator('html')).toHaveAttribute('lang', /\S+/);
      await expect(page.locator('link[rel="icon"]')).toHaveCount(2);
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
        'href',
        '/site.webmanifest',
      );
      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);

      const ogTitle = (await metaContent(page, 'meta[property="og:title"]'))?.trim();
      const ogDescription = (
        await metaContent(page, 'meta[property="og:description"]')
      )?.trim();
      const ogUrl = (await metaContent(page, 'meta[property="og:url"]'))?.trim();
      const ogImage = (await metaContent(page, 'meta[property="og:image"]'))?.trim();
      const ogImageAlt = (
        await metaContent(page, 'meta[property="og:image:alt"]')
      )?.trim();

      expect(ogTitle).toBe(title);
      expect(ogDescription).toBe(description);
      expect(ogUrl).toBe(canonical);
      expect(ogImage).toBe(`${SITE_ORIGIN}/og-image.jpg`);
      expect(ogImageAlt).toBe(title);

      const twCard = (await metaContent(page, 'meta[name="twitter:card"]'))?.trim();
      const twTitle = (await metaContent(page, 'meta[name="twitter:title"]'))?.trim();
      const twDescription = (
        await metaContent(page, 'meta[name="twitter:description"]')
      )?.trim();
      const twImage = (await metaContent(page, 'meta[name="twitter:image"]'))?.trim();
      const twImageAlt = (
        await metaContent(page, 'meta[name="twitter:image:alt"]')
      )?.trim();

      expect(twCard).toBe('summary_large_image');
      expect(twTitle).toBe(title);
      expect(twDescription).toBe(description);
      expect(twImage).toBe(`${SITE_ORIGIN}/og-image.jpg`);
      expect(twImageAlt).toBe(title);

      await expect(page.locator('h1')).toHaveCount(1);
      const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((nodes) =>
        nodes.map((el) => Number(el.tagName.slice(1))),
      );
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
      }

      const imgs = page.locator('img');
      const imgCount = await imgs.count();
      for (let i = 0; i < imgCount; i += 1) {
        await expect(imgs.nth(i)).toHaveAttribute('alt', /.*/);
      }
    });
  }

  test('robots.txt, sitemap.xml, manifest, and favicons are reachable', async ({
    request,
  }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    const robotsText = await robots.text();
    expect(robotsText).toMatch(/User-agent:\s*\*/i);
    expect(robotsText).toMatch(/Allow:\s*\//i);
    expect(robotsText).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);

    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBeTruthy();
    const sitemapText = await sitemap.text();
    expect(sitemapText).toContain('<urlset');
    expect(sitemapText).toContain(`<loc>${SITE_ORIGIN}/</loc>`);

    const manifest = await request.get('/site.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const manifestJson = await manifest.json();
    expect(manifestJson.name).toBeTruthy();
    expect(Array.isArray(manifestJson.icons)).toBeTruthy();
    expect(manifestJson.icons.length).toBeGreaterThan(0);
    expect(manifestJson.start_url).toBe('/');

    for (const path of [
      '/public/favicon.ico',
      '/public/favicon.svg',
      '/public/apple-touch-icon.png',
      '/og-image.jpg',
    ]) {
      const res = await request.get(path);
      expect(res.ok(), path).toBeTruthy();
    }
  });
});
