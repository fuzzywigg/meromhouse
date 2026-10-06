import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'),
  'utf8',
);

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
});
