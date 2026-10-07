/**
 * Broken-link check for the static site: internal paths and in-page anchors.
 * Does not fetch external URLs (read-only CI, no network dependency).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ORIGIN = 'https://meromhouse.org';

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** Map a site URL or path to a repo-relative filesystem path, or null if external. */
function toLocalPath(ref) {
  if (!ref || ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('data:')) {
    return null;
  }
  let pathPart = ref;
  let hash = '';
  const hashIdx = ref.indexOf('#');
  if (hashIdx !== -1) {
    pathPart = ref.slice(0, hashIdx);
    hash = ref.slice(hashIdx + 1);
  }
  if (!pathPart) {
    return { kind: 'anchor', hash };
  }
  if (/^https?:\/\//i.test(pathPart)) {
    let url;
    try {
      url = new URL(pathPart);
    } catch {
      return { kind: 'invalid', ref };
    }
    if (url.origin !== SITE_ORIGIN && url.hostname !== 'www.meromhouse.org') {
      return null; // external — out of scope
    }
    pathPart = url.pathname || '/';
  }
  if (pathPart.startsWith('//')) return null;
  if (!pathPart.startsWith('/')) {
    // relative to site root for this single-page site
    pathPart = `/${pathPart}`;
  }
  let filePath = pathPart;
  if (filePath.endsWith('/')) filePath += 'index.html';
  if (filePath === '/') filePath = '/index.html';
  // strip leading slash for join
  const rel = normalize(filePath.replace(/^\//, ''));
  if (rel.startsWith('..')) {
    return { kind: 'invalid', ref };
  }
  return { kind: 'file', rel, hash: hash || null, ref };
}

function collectHtmlRefs(html) {
  const refs = [];
  const attrRe = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(html))) refs.push({ ref: m[1], via: 'attr' });

  const metaRe = /<meta\b[^>]*\b(?:property|name)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const name = m[1];
    if (!/^(og:image|twitter:image|og:url)$/i.test(name)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (content) refs.push({ ref: content[1], via: `meta:${name}` });
  }
  return refs;
}

describe('internal links and anchors', () => {
  const html = read('index.html');
  const ids = new Set(
    [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]),
  );

  it('resolves every internal href/src and same-origin meta URL to a file', () => {
    const refs = collectHtmlRefs(html);
    assert.ok(refs.length > 0, 'expected refs in index.html');

    const missing = [];
    for (const { ref, via } of refs) {
      const mapped = toLocalPath(ref);
      if (!mapped) continue;
      if (mapped.kind === 'invalid') {
        missing.push(`${via}: invalid ${ref}`);
        continue;
      }
      if (mapped.kind === 'anchor') {
        assert.ok(ids.has(mapped.hash), `missing anchor #${mapped.hash} (${via})`);
        continue;
      }
      if (mapped.kind === 'file') {
        const abs = join(ROOT, mapped.rel);
        if (!existsSync(abs)) missing.push(`${via}: ${ref} -> ${mapped.rel}`);
        if (mapped.hash) {
          assert.ok(
            ids.has(mapped.hash),
            `missing anchor #${mapped.hash} on ${ref} (${via})`,
          );
        }
      }
    }
    assert.deepEqual(missing, [], `broken internal refs:\n${missing.join('\n')}`);
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
});
