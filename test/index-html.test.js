import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const deploy = readFileSync(join(root, 'DEPLOY.md'), 'utf8');

function inlineScripts(source) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(source))) {
    if (!/\ssrc\s*=/i.test(match[1] || '')) blocks.push(match[2]);
  }
  return blocks.join('\n');
}

describe('index.html', () => {
  it('has an element for every id the inline script uses', () => {
    const script = inlineScripts(html);
    const ids = new Set();
    const re = /(?:getElementById|setEl)\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(script))) ids.add(match[1]);
    assert.ok(ids.size > 0, 'expected the script to reference element ids');
    for (const id of ids) {
      assert.match(html, new RegExp(`\\sid=["']${id}["']`), `missing element id ${id}`);
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

  it('does not load a third-party script src', () => {
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

  it('offers a skip link to main and labels each card with an h2', () => {
    assert.match(html, /<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#main["']/i);
    assert.match(html, /<main\b[^>]*\bid=["']main["']/i);
    const headings = [...html.matchAll(/<h2\b[^>]*\bid=["'](card-[^"']+)["'][^>]*>([^<]+)<\/h2>/gi)];
    assert.equal(headings.length, 6, 'expected six card h2 headings');
    for (const [, id] of headings) {
      assert.match(
        html,
        new RegExp(`<section\\b[^>]*aria-labelledby=["']${id}["']`, 'i'),
        `missing section for ${id}`,
      );
    }
  });

  it('hides decorative status dots and card icons from assistive tech', () => {
    const icons = [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bcard-icon\b[^"']*["'][^>]*>/gi)];
    assert.ok(icons.length >= 6, 'expected card icons');
    for (const [tag] of icons) {
      assert.match(tag, /\baria-hidden=["']true["']/i, tag);
    }

    const dots = [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bstatus-dot\b[^"']*["'][^>]*>/gi)];
    assert.ok(dots.length >= 3, 'expected status dots');
    for (const [tag] of dots) {
      assert.match(tag, /\baria-hidden=["']true["']/i, tag);
    }
  });

  it('keeps narrow layouts from forcing single-line flex rows', () => {
    assert.match(html, /\.header-meta\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /\.card-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /\.project-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /grid-template-columns:\s*repeat\(\s*auto-fill,\s*minmax\(\s*min\(\s*320px,\s*100%\s*\)/i);
  });

  it('labels the refresh timestamp as GitHub-only', () => {
    assert.match(html, /GitHub last updated:\s*<span\b[^>]*\bid=["']last-updated["']/i);
    assert.doesNotMatch(html, /\|\s*Last updated:/i);
  });

  it('pauses GitHub and health polling while the tab is hidden', () => {
    const script = inlineScripts(html);
    assert.match(script, /document\.addEventListener\(\s*['"]visibilitychange['"]/);
    assert.match(script, /if\s*\(\s*document\.hidden\s*\)\s*\{[\s\S]*stopRefreshTimer\(\);[\s\S]*stopHealthTimer\(\);/);
    assert.match(script, /function\s+startRefreshTimer\s*\(\s*\)\s*\{[\s\S]*document\.hidden/);
    assert.match(script, /function\s+startHealthTimer\s*\(\s*\)\s*\{[\s\S]*document\.hidden/);
    assert.match(script, /healthTimer\s*=\s*setInterval\(\s*loadHealth\s*,\s*REFRESH_MS\s*\)/);
    assert.match(script, /refreshTimer\s*=\s*setInterval\(\s*refresh\s*,\s*REFRESH_MS\s*\)/);
  });
});

describe('docs: live poll pause-when-hidden', () => {
  it('documents /api/health polling only while the tab is visible', () => {
    assert.match(
      readme,
      /fetch \/api\/health<br\/>while the tab is visible/,
    );
    assert.match(
      readme,
      /`\/api\/health`\s*\|\s*Live same-origin fetch every 5 minutes while the tab is visible;\s*paused when the tab is hidden/i,
    );
    assert.match(
      readme,
      /Both live polls use a 5-minute interval and pause on `visibilitychange` when `document\.hidden` is true/i,
    );
    assert.match(deploy, /\/api\/health` every 5 minutes while the tab is visible;\s*both pause when the tab is hidden/i);
  });
});
