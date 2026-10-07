#!/usr/bin/env node
/**
 * Offline internal link / asset checker.
 *
 * Every href/src (plus srcset, CSS url(), same-origin meta images) in HTML must
 * resolve to a repo file, an in-page anchor, or a known Pages Function route.
 * External URLs, mailto:, tel:, and data: are skipped (no network).
 *
 * Usage: node scripts/check-links.mjs
 * Exit: 0 on success, 1 on missing refs.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ORIGIN = 'https://meromhouse.org';
const SITE_HOSTS = new Set(['meromhouse.org', 'www.meromhouse.org']);

/** Pages Function routes derived from functions/api/*.js, plus `/`. */
export function discoverKnownRoutes(root = ROOT) {
  const routes = new Set(['/']);
  const apiDir = join(root, 'functions', 'api');
  if (!existsSync(apiDir)) return routes;
  for (const name of readdirSync(apiDir)) {
    if (!name.endsWith('.js')) continue;
    routes.add(`/api/${name.slice(0, -3)}`);
  }
  return routes;
}

/**
 * Map a site URL or path to a local check target, or null if out of scope.
 * @returns {null | { kind: 'anchor', hash: string } | { kind: 'invalid', ref: string } | { kind: 'file', rel: string, hash: string | null, ref: string, pathPart: string }}
 */
export function toLocalPath(ref) {
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
    if (!SITE_HOSTS.has(url.hostname)) {
      return null;
    }
    pathPart = url.pathname || '/';
  }
  if (pathPart.startsWith('//')) return null;
  if (!pathPart.startsWith('/')) {
    pathPart = `/${pathPart}`;
  }
  let filePath = pathPart;
  if (filePath.endsWith('/')) filePath += 'index.html';
  if (filePath === '/') filePath = '/index.html';
  const rel = normalize(filePath.replace(/^\//, ''));
  if (rel.startsWith('..')) {
    return { kind: 'invalid', ref };
  }
  return { kind: 'file', rel, hash: hash || null, ref, pathPart };
}

/** Collect href, src, srcset tokens, CSS url(), and key meta image/url contents. */
export function collectHtmlRefs(html) {
  const refs = [];
  const attrRe = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = attrRe.exec(html))) refs.push({ ref: m[1], via: 'attr' });

  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(',')) {
      const token = part.trim().split(/\s+/)[0];
      if (token) refs.push({ ref: token, via: 'srcset' });
    }
  }

  const urlRe = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  while ((m = urlRe.exec(html))) refs.push({ ref: m[1], via: 'css-url' });

  const metaRe = /<meta\b[^>]*>/gi;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const nameMatch = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    if (!/^(og:image|twitter:image|og:url)$/i.test(name)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']+)["']/i);
    if (content) refs.push({ ref: content[1], via: `meta:${name}` });
  }
  return refs;
}

export function collectElementIds(html) {
  return new Set([...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]));
}

/**
 * Run the full offline check.
 * @returns {{ ok: boolean, missing: string[], checked: number, knownRoutes: string[] }}
 */
export function checkInternalLinks(root = ROOT) {
  const knownRoutes = discoverKnownRoutes(root);
  const htmlPath = join(root, 'index.html');
  const html = readFileSync(htmlPath, 'utf8');
  const ids = collectElementIds(html);
  const missing = [];
  let checked = 0;

  const resolveOne = (ref, via) => {
    const mapped = toLocalPath(ref);
    if (!mapped) return;
    checked += 1;
    if (mapped.kind === 'invalid') {
      missing.push(`${via}: invalid ${ref}`);
      return;
    }
    if (mapped.kind === 'anchor') {
      if (!ids.has(mapped.hash)) missing.push(`${via}: missing anchor #${mapped.hash}`);
      return;
    }
    if (mapped.kind === 'file') {
      if (knownRoutes.has(mapped.pathPart)) {
        // Pages Function / known route — no static file required
      } else {
        const abs = join(root, mapped.rel);
        if (!existsSync(abs)) missing.push(`${via}: ${ref} -> ${mapped.rel}`);
      }
      if (mapped.hash && !ids.has(mapped.hash)) {
        missing.push(`${via}: missing anchor #${mapped.hash} on ${ref}`);
      }
    }
  };

  for (const { ref, via } of collectHtmlRefs(html)) {
    resolveOne(ref, via);
  }

  const manifest = JSON.parse(readFileSync(join(root, 'site.webmanifest'), 'utf8'));
  for (const icon of manifest.icons || []) {
    resolveOne(icon.src, 'manifest:icon');
  }
  if (manifest.start_url) resolveOne(manifest.start_url, 'manifest:start_url');

  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  for (const loc of [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())) {
    resolveOne(loc, 'sitemap:loc');
  }

  return {
    ok: missing.length === 0,
    missing,
    checked,
    knownRoutes: [...knownRoutes].sort(),
  };
}

function main() {
  const result = checkInternalLinks();
  console.log(
    `check-links: checked ${result.checked} internal refs; known routes: ${result.knownRoutes.join(', ')}`,
  );
  if (!result.ok) {
    console.error('broken internal refs:');
    for (const line of result.missing) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log('check-links: ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
