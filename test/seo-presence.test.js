/**
 * Technical SEO / metadata gates: titles, descriptions, canonical, OG/Twitter,
 * robots/sitemap/manifest, heading hierarchy, img alt. Blocking for site pages.
 * Does not invent copy — only presence, uniqueness, and reuse consistency.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkSeoPresence,
  discoverHtmlPages,
  inspectManifest,
  inspectRobotsTxt,
  inspectSeoPresence,
  inspectSitemap,
  pagePathFromRel,
} from '../scripts/check-seo-presence.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MINIMAL_OK = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Example Page</title>
  <meta name="description" content="Example description for tests.">
  <link rel="canonical" href="https://meromhouse.org/">
  <link rel="icon" href="/public/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/public/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:title" content="Example Page">
  <meta property="og:description" content="Example description for tests.">
  <meta property="og:url" content="https://meromhouse.org/">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://meromhouse.org/og-image.jpg">
  <meta property="og:image:alt" content="Example Page">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Example Page">
  <meta name="twitter:description" content="Example description for tests.">
  <meta name="twitter:image" content="https://meromhouse.org/og-image.jpg">
  <meta name="twitter:image:alt" content="Example Page">
</head>
<body>
  <h1>Example</h1>
  <h2>Section</h2>
  <img src="/og-image.jpg" alt="">
</body>
</html>`;

describe('SEO scanner (fixtures)', () => {
  it('maps index.html to canonical path /', () => {
    assert.equal(pagePathFromRel('index.html'), '/');
    assert.equal(pagePathFromRel('nested/index.html'), '/nested/');
    assert.equal(pagePathFromRel('about.html'), '/about.html');
  });

  it('accepts a complete technical SEO shell', () => {
    const result = inspectSeoPresence(MINIMAL_OK, 'fixture-ok.html', {
      expectedPath: '/',
    });
    assert.equal(result.ok, true, result.missing.join('; '));
    assert.deepEqual(result.missing, []);
    assert.equal(result.title, 'Example Page');
    assert.equal(result.description, 'Example description for tests.');
  });

  it('reports missing lang, title, and meta description without reading wording', () => {
    const html = `<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>`;
    const result = inspectSeoPresence(html, 'fixture-gaps.html');
    assert.equal(result.ok, false);
    assert.ok(result.missing.some((m) => /lang/i.test(m)));
    assert.ok(result.missing.some((m) => /title/i.test(m)));
    assert.ok(result.missing.some((m) => /description/i.test(m)));
  });

  it('treats empty lang, title, and description content as missing', () => {
    const html = `<!DOCTYPE html>
<html lang="  ">
<head>
  <title>   </title>
  <meta name="description" content="">
</head>
<body></body>
</html>`;
    const result = inspectSeoPresence(html);
    assert.equal(result.ok, false);
    assert.ok(result.missing.some((m) => /lang/i.test(m)));
    assert.ok(result.missing.some((m) => /title/i.test(m)));
    assert.ok(result.missing.some((m) => /description/i.test(m)));
  });

  it('requires OG/Twitter titles and descriptions to reuse page values', () => {
    const mismatched = MINIMAL_OK.replace(
      '<meta property="og:title" content="Example Page">',
      '<meta property="og:title" content="Other Title">',
    ).replace(
      '<meta name="twitter:description" content="Example description for tests.">',
      '<meta name="twitter:description" content="Other description.">',
    );
    const result = inspectSeoPresence(mismatched, 'fixture-mismatch.html', {
      expectedPath: '/',
    });
    assert.equal(result.ok, false);
    assert.ok(result.missing.some((m) => /og:title must reuse/i.test(m)));
    assert.ok(
      result.missing.some((m) => /twitter:description must reuse/i.test(m)),
    );
  });

  it('flags heading skips and missing img alt', () => {
    const html = MINIMAL_OK.replace('<h2>Section</h2>', '<h3>Skipped</h3>').replace(
      'alt=""',
      '',
    );
    const result = inspectSeoPresence(html, 'fixture-a11y.html', {
      expectedPath: '/',
    });
    assert.equal(result.ok, false);
    assert.ok(result.missing.some((m) => /heading hierarchy skip/i.test(m)));
    assert.ok(result.missing.some((m) => /img missing alt/i.test(m)));
  });
});

describe('SEO site assets (robots / sitemap / manifest)', () => {
  it('robots.txt allows crawl and points at the canonical sitemap', () => {
    const result = inspectRobotsTxt(ROOT);
    assert.equal(result.ok, true, result.missing.join('; '));
  });

  it('sitemap lists every site HTML page and resolves locs', () => {
    const pages = discoverHtmlPages(ROOT).map((abs) => relative(ROOT, abs));
    const result = inspectSitemap(ROOT, pages);
    assert.equal(result.ok, true, result.missing.join('; '));
    assert.ok(result.locs.includes('https://meromhouse.org/'));
  });

  it('site.webmanifest has required fields and resolvable icons', () => {
    const result = inspectManifest(ROOT);
    assert.equal(result.ok, true, result.missing.join('; '));
  });
});

describe('SEO presence against site pages (blocking)', () => {
  it('discovers at least index.html', () => {
    const pages = discoverHtmlPages(ROOT);
    assert.ok(
      pages.some((p) => p.endsWith('index.html')),
      `expected index.html in ${pages.join(', ')}`,
    );
  });

  it('passes technical SEO gates for every site HTML page', () => {
    const result = checkSeoPresence(ROOT);
    assert.ok(result.checked > 0, 'expected at least one HTML page');
    const gaps = [];
    for (const page of result.pages) {
      if (!page.ok) {
        gaps.push(`${page.label}: ${page.missing.join('; ')}`);
      }
    }
    if (result.siteMissing.length) {
      gaps.push(`site: ${result.siteMissing.join('; ')}`);
    }
    assert.equal(result.ok, true, `SEO gaps:\n${gaps.join('\n')}`);
  });
});
