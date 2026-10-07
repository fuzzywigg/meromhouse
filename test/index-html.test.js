import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const dashboardJs = readFileSync(join(root, 'assets', 'dashboard.js'), 'utf8');

describe('index.html', () => {
  it('has an element for every id the dashboard script uses', () => {
    const ids = new Set();
    const re = /(?:getElementById|setEl)\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(dashboardJs))) ids.add(match[1]);
    assert.ok(ids.size > 0, 'expected the script to reference element ids');
    for (const id of ids) {
      assert.match(html, new RegExp(`\\sid=["']${id}["']`), `missing element id ${id}`);
    }
  });

  it('loads dashboard.js with defer and no third-party script src', () => {
    assert.match(html, /<script\b[^>]*\ssrc=["']\/assets\/dashboard\.js["'][^>]*\sdefer\b/i);
    const re = /<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = re.exec(html))) {
      const src = match[1];
      assert.doesNotMatch(src, /^\/\//, src);
      if (/^https?:\/\//i.test(src)) {
        const host = new URL(src).host;
        assert.ok(host === 'meromhouse.org' || host === 'www.meromhouse.org', src);
      }
    }
  });

  it('sets rel=noopener on every external link', () => {
    const re = /<a\b[^>]*>/gi;
    let match;
    let seen = 0;
    while ((match = re.exec(html))) {
      const tag = match[0];
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (!href || !/^https?:\/\//i.test(href[1])) continue;
      seen += 1;
      assert.match(tag, /\brel\s*=\s*["'][^"']*\bnoopener\b/i, tag);
    }
    assert.ok(seen > 0, 'expected external links');
  });

  it('includes description, Open Graph, and Twitter meta tags', () => {
    const required = [
      /<meta\s+name=["']description["']/i,
      /<meta\s+property=["']og:title["']/i,
      /<meta\s+property=["']og:description["']/i,
      /<meta\s+property=["']og:url["']/i,
      /<meta\s+property=["']og:type["']/i,
      /<meta\s+property=["']og:image["']/i,
      /<meta\s+name=["']twitter:card["']/i,
      /<meta\s+name=["']twitter:title["']/i,
      /<meta\s+name=["']twitter:description["']/i,
      /<meta\s+name=["']twitter:image["']/i,
    ];
    for (const pattern of required) assert.match(html, pattern);
  });

  it('preloads critical fonts and serves modern image formats with dimensions', () => {
    assert.match(html, /rel=["']preload["'][^>]*as=["']font["']/i);
    assert.match(html, /source-sans-3-latin-400-normal\.woff2/);
    assert.match(html, /<picture>[\s\S]*og-image-600\.avif[\s\S]*og-image-600\.webp[\s\S]*<\/picture>/i);
    assert.match(
      html,
      /<img\b[^>]*\bwidth=["']600["'][^>]*\bheight=["']315["'][^>]*\bloading=["']lazy["']/i,
    );
  });
});
