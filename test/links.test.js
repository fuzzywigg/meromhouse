/**
 * Broken-link check for the static site: internal paths and in-page anchors.
 * Does not fetch external URLs (read-only CI, no network dependency).
 * Shared implementation: scripts/check-links.mjs (`npm run check:links`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkInternalLinks,
  collectElementIds,
  collectHtmlRefs,
  discoverKnownRoutes,
  toLocalPath,
} from '../scripts/check-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('internal links and anchors', () => {
  const html = read('index.html');
  const ids = collectElementIds(html);

  it('discovers Pages Function API routes as known routes', () => {
    const routes = discoverKnownRoutes(ROOT);
    assert.ok(routes.has('/'));
    assert.ok(routes.has('/api/health'));
    assert.ok(routes.has('/api/github-stats'));
  });

  it('resolves every internal href/src and same-origin meta URL to a file or known route', () => {
    const result = checkInternalLinks(ROOT);
    assert.ok(result.checked > 0, 'expected refs in index.html');
    assert.deepEqual(result.missing, [], `broken internal refs:\n${result.missing.join('\n')}`);
  });

  it('resolves site.webmanifest icon paths', () => {
    const manifest = JSON.parse(read('site.webmanifest'));
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
    for (const icon of manifest.icons) {
      const mapped = toLocalPath(icon.src);
      assert.ok(mapped && mapped.kind === 'file', icon.src);
      assert.ok(existsSync(join(ROOT, mapped.rel)), `missing icon ${icon.src}`);
    }
  });

  it('sitemap loc points at a local page that exists', () => {
    const sitemap = read('sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    assert.ok(locs.length > 0);
    for (const loc of locs) {
      const mapped = toLocalPath(loc);
      assert.ok(mapped && mapped.kind === 'file', loc);
      assert.ok(existsSync(join(ROOT, mapped.rel)), `sitemap loc missing: ${loc}`);
    }
  });

  it('has no dangling in-page hash links', () => {
    const hashes = [...html.matchAll(/\bhref=["'](#[^"']+)["']/gi)].map((m) => m[1]);
    for (const href of hashes) {
      const id = href.slice(1);
      assert.ok(ids.has(id), `broken anchor ${href}`);
    }
  });

  it('collects srcset and CSS url() asset refs', () => {
    const refs = collectHtmlRefs(html);
    const vias = new Set(refs.map((r) => r.via));
    assert.ok(vias.has('srcset'), 'expected picture srcset refs');
    assert.ok(vias.has('css-url'), 'expected @font-face url() refs');
  });
});
