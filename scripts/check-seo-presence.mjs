#!/usr/bin/env node
/**
 * Blocking technical SEO / metadata gate for the static site.
 *
 * Checks every *.html page under the site root (excluding tooling dirs) for:
 *   - <html lang> (non-empty)
 *   - <title> (non-empty) and unique across pages
 *   - <meta name="description"> with non-empty content, unique across pages
 *   - canonical URL (https://meromhouse.org/… matching the page path)
 *   - Open Graph + Twitter card tags; titles/descriptions reuse page values
 *   - heading hierarchy (exactly one h1; no skipped levels)
 *   - every <img> has an alt attribute (empty allowed for decorative)
 *
 * Also verifies robots.txt, sitemap.xml, and site.webmanifest structure.
 * Does not invent copy and does not fetch the network.
 *
 * Usage: node scripts/check-seo-presence.mjs
 * Exit: 0 when all gates pass; 1 on any gap.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_ORIGIN = 'https://meromhouse.org';

const SKIP_DIRS = new Set([
  '.git',
  '.wrangler',
  'node_modules',
  'test',
  'docs',
  'scripts',
  'functions',
]);

const REQUIRED_OG = [
  'og:title',
  'og:description',
  'og:url',
  'og:type',
  'og:image',
  'og:image:alt',
];

const REQUIRED_TWITTER = [
  'twitter:card',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt',
];

/**
 * Recursively find HTML files under root, skipping tooling dirs.
 * @param {string} root
 * @returns {string[]} absolute paths
 */
export function discoverHtmlPages(root = ROOT) {
  const pages = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(abs);
        continue;
      }
      if (entry.isFile() && /\.html?$/i.test(entry.name)) {
        pages.push(abs);
      }
    }
  };

  walk(root);
  return pages.sort();
}

/**
 * Map a site-root-relative HTML path to its public URL path.
 * index.html → /, about.html → /about.html, nested/index.html → /nested/
 * @param {string} rel
 */
export function pagePathFromRel(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `/${normalized}`;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function metaContent(html, attr, name) {
  const re = new RegExp(
    `<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  const tag = html.match(re);
  if (!tag) return null;
  const content = tag[0].match(/\bcontent\s*=\s*["']([^"']*)["']/i);
  return content ? decodeHtmlEntities(content[1].trim()) : '';
}

function linkHref(html, rel) {
  const re = new RegExp(
    `<link\\b[^>]*\\brel\\s*=\\s*["']${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  const tag = html.match(re);
  if (!tag) return null;
  const href = tag[0].match(/\bhref\s*=\s*["']([^"']*)["']/i);
  return href ? href[1].trim() : '';
}

function extractHeadings(html) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  return [...body.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => Number(m[1]));
}

/**
 * Inspect one HTML document for technical SEO / metadata gates.
 * Presence and consistency only — does not invent or grade wording quality.
 * @param {string} html
 * @param {string} [label]
 * @param {{ expectedPath?: string }} [opts]
 * @returns {{
 *   label: string,
 *   ok: boolean,
 *   missing: string[],
 *   title: string,
 *   description: string,
 * }}
 */
export function inspectSeoPresence(html, label = 'document', opts = {}) {
  const missing = [];
  let title = '';
  let description = '';

  const langMatch = html.match(/<html\b([^>]*)>/i);
  if (!langMatch) {
    missing.push('html element');
  } else {
    const langAttr = langMatch[1].match(/\blang\s*=\s*["']([^"']*)["']/i);
    if (!langAttr || !langAttr[1].trim()) {
      missing.push('lang attribute on <html>');
    }
  }

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  title = titleMatch
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim())
    : '';
  if (!title) missing.push('<title> with non-empty text');

  const descRaw = metaContent(html, 'name', 'description');
  if (descRaw === null) {
    missing.push('<meta name="description"> tag');
  } else if (!descRaw) {
    missing.push('<meta name="description"> with non-empty content');
  } else {
    description = descRaw;
  }

  const canonical = linkHref(html, 'canonical');
  if (canonical === null || canonical === '') {
    missing.push('<link rel="canonical">');
  } else if (opts.expectedPath) {
    const expected = `${SITE_ORIGIN}${opts.expectedPath}`;
    if (canonical !== expected) {
      missing.push(`canonical URL (expected ${expected}, got ${canonical})`);
    }
  } else if (!canonical.startsWith(`${SITE_ORIGIN}/`) && canonical !== SITE_ORIGIN) {
    missing.push(`canonical URL on ${SITE_ORIGIN}`);
  }

  if (!linkHref(html, 'icon') && !linkHref(html, 'shortcut icon')) {
    missing.push('<link rel="icon">');
  }
  if (linkHref(html, 'manifest') === null) {
    missing.push('<link rel="manifest">');
  }
  if (linkHref(html, 'apple-touch-icon') === null) {
    missing.push('<link rel="apple-touch-icon">');
  }

  for (const prop of REQUIRED_OG) {
    const value = metaContent(html, 'property', prop);
    if (value === null) missing.push(`<meta property="${prop}">`);
    else if (!value) missing.push(`<meta property="${prop}"> with non-empty content`);
  }
  for (const name of REQUIRED_TWITTER) {
    const value = metaContent(html, 'name', name);
    if (value === null) missing.push(`<meta name="${name}">`);
    else if (!value) missing.push(`<meta name="${name}"> with non-empty content`);
  }

  if (title) {
    const ogTitle = metaContent(html, 'property', 'og:title');
    const twTitle = metaContent(html, 'name', 'twitter:title');
    if (ogTitle !== null && ogTitle && ogTitle !== title) {
      missing.push('og:title must reuse <title> text');
    }
    if (twTitle !== null && twTitle && twTitle !== title) {
      missing.push('twitter:title must reuse <title> text');
    }
    const ogImageAlt = metaContent(html, 'property', 'og:image:alt');
    const twImageAlt = metaContent(html, 'name', 'twitter:image:alt');
    if (ogImageAlt !== null && ogImageAlt && ogImageAlt !== title) {
      missing.push('og:image:alt must reuse <title> text');
    }
    if (twImageAlt !== null && twImageAlt && twImageAlt !== title) {
      missing.push('twitter:image:alt must reuse <title> text');
    }
  }

  if (description) {
    const ogDesc = metaContent(html, 'property', 'og:description');
    const twDesc = metaContent(html, 'name', 'twitter:description');
    if (ogDesc !== null && ogDesc && ogDesc !== description) {
      missing.push('og:description must reuse meta description');
    }
    if (twDesc !== null && twDesc && twDesc !== description) {
      missing.push('twitter:description must reuse meta description');
    }
  }

  const ogUrl = metaContent(html, 'property', 'og:url');
  if (canonical && ogUrl !== null && ogUrl && ogUrl !== canonical) {
    missing.push('og:url must match canonical');
  }

  const twitterCard = metaContent(html, 'name', 'twitter:card');
  if (twitterCard !== null && twitterCard && !/^(summary|summary_large_image|app|player)$/.test(twitterCard)) {
    missing.push('twitter:card value');
  }

  const headings = extractHeadings(html);
  const h1Count = headings.filter((level) => level === 1).length;
  if (h1Count !== 1) {
    missing.push(`exactly one <h1> (found ${h1Count})`);
  }
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] > headings[i - 1] + 1) {
      missing.push(
        `heading hierarchy skip (h${headings[i - 1]} → h${headings[i]})`,
      );
      break;
    }
  }

  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of imgs) {
    if (!/\balt\s*=\s*["'][^"']*["']/i.test(tag)) {
      missing.push(`img missing alt attribute: ${tag.slice(0, 80)}`);
    }
  }

  return { label, ok: missing.length === 0, missing, title, description };
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function inspectRobotsTxt(root = ROOT) {
  const missing = [];
  const path = join(root, 'robots.txt');
  if (!existsSync(path)) {
    return { ok: false, missing: ['robots.txt file'] };
  }
  const text = readFileSync(path, 'utf8');
  if (!/^\s*User-agent:\s*\*/im.test(text)) {
    missing.push('robots.txt User-agent: *');
  }
  if (!/^\s*Allow:\s*\/\s*$/im.test(text)) {
    missing.push('robots.txt Allow: /');
  }
  const sitemapLine = text.match(/^\s*Sitemap:\s*(\S+)\s*$/im);
  if (!sitemapLine) {
    missing.push('robots.txt Sitemap: URL');
  } else if (sitemapLine[1] !== `${SITE_ORIGIN}/sitemap.xml`) {
    missing.push(
      `robots.txt Sitemap URL (expected ${SITE_ORIGIN}/sitemap.xml, got ${sitemapLine[1]})`,
    );
  }
  return { ok: missing.length === 0, missing };
}

/**
 * @param {string} root
 * @param {string[]} htmlRels relative paths of HTML pages
 * @returns {{ ok: boolean, missing: string[], locs: string[] }}
 */
export function inspectSitemap(root = ROOT, htmlRels = []) {
  const missing = [];
  const path = join(root, 'sitemap.xml');
  if (!existsSync(path)) {
    return { ok: false, missing: ['sitemap.xml file'], locs: [] };
  }
  const xml = readFileSync(path, 'utf8');
  if (!/<urlset\b/i.test(xml)) missing.push('sitemap.xml <urlset>');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (locs.length === 0) missing.push('sitemap.xml <loc> entries');

  const expected = new Set(
    htmlRels.map((rel) => `${SITE_ORIGIN}${pagePathFromRel(rel)}`),
  );
  for (const loc of locs) {
    if (!loc.startsWith(`${SITE_ORIGIN}/`) && loc !== SITE_ORIGIN) {
      missing.push(`sitemap loc off-origin: ${loc}`);
      continue;
    }
    const urlPath = loc === SITE_ORIGIN ? '/' : new URL(loc).pathname;
    const fileRel =
      urlPath === '/'
        ? 'index.html'
        : urlPath.endsWith('/')
          ? `${urlPath.slice(1)}index.html`
          : urlPath.replace(/^\//, '');
    if (!existsSync(join(root, fileRel))) {
      missing.push(`sitemap loc missing file: ${loc}`);
    }
  }

  for (const want of expected) {
    if (!locs.includes(want)) {
      missing.push(`sitemap missing page: ${want}`);
    }
  }

  return { ok: missing.length === 0, missing, locs };
}

/**
 * @param {string} root
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function inspectManifest(root = ROOT) {
  const missing = [];
  const path = join(root, 'site.webmanifest');
  if (!existsSync(path)) {
    return { ok: false, missing: ['site.webmanifest file'] };
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { ok: false, missing: ['site.webmanifest valid JSON'] };
  }
  if (!manifest.name || !String(manifest.name).trim()) {
    missing.push('manifest.name');
  }
  if (!manifest.short_name || !String(manifest.short_name).trim()) {
    missing.push('manifest.short_name');
  }
  if (!manifest.start_url) missing.push('manifest.start_url');
  if (!manifest.display) missing.push('manifest.display');
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    missing.push('manifest.icons');
  } else {
    for (const icon of manifest.icons) {
      if (!icon.src) {
        missing.push('manifest.icons[].src');
        continue;
      }
      const rel = String(icon.src).replace(/^\//, '');
      if (!existsSync(join(root, rel))) {
        missing.push(`manifest icon missing: ${icon.src}`);
      }
    }
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Run all technical SEO checks.
 * @param {string} root
 * @returns {{
 *   ok: boolean,
 *   pages: ReturnType<typeof inspectSeoPresence>[],
 *   checked: number,
 *   siteMissing: string[],
 * }}
 */
export function checkSeoPresence(root = ROOT) {
  const files = discoverHtmlPages(root);
  const pages = files.map((abs) => {
    const rel = relative(root, abs) || abs;
    const html = readFileSync(abs, 'utf8');
    return inspectSeoPresence(html, rel, {
      expectedPath: pagePathFromRel(rel),
    });
  });

  const siteMissing = [];
  const titles = new Map();
  const descriptions = new Map();
  for (const page of pages) {
    if (page.title) {
      if (titles.has(page.title)) {
        siteMissing.push(
          `duplicate <title> on ${titles.get(page.title)} and ${page.label}`,
        );
      } else {
        titles.set(page.title, page.label);
      }
    }
    if (page.description) {
      if (descriptions.has(page.description)) {
        siteMissing.push(
          `duplicate meta description on ${descriptions.get(page.description)} and ${page.label}`,
        );
      } else {
        descriptions.set(page.description, page.label);
      }
    }
  }

  const robots = inspectRobotsTxt(root);
  siteMissing.push(...robots.missing);

  const sitemap = inspectSitemap(
    root,
    files.map((abs) => relative(root, abs) || abs),
  );
  siteMissing.push(...sitemap.missing);

  const manifest = inspectManifest(root);
  siteMissing.push(...manifest.missing);

  const faviconSvg = join(root, 'public', 'favicon.svg');
  const faviconIco = join(root, 'public', 'favicon.ico');
  if (!existsSync(faviconSvg)) siteMissing.push('public/favicon.svg');
  if (!existsSync(faviconIco)) siteMissing.push('public/favicon.ico');
  if (!existsSync(join(root, 'og-image.jpg'))) siteMissing.push('og-image.jpg');

  return {
    ok: pages.every((p) => p.ok) && siteMissing.length === 0,
    pages,
    checked: pages.length,
    siteMissing,
  };
}

function main() {
  const result = checkSeoPresence();
  console.log(`check-seo: checked ${result.checked} HTML page(s)`);
  for (const page of result.pages) {
    if (page.ok) {
      console.log(`  ok  ${page.label}`);
    } else {
      console.warn(`  FAIL ${page.label}:`);
      for (const item of page.missing) console.warn(`       - ${item}`);
    }
  }
  if (result.siteMissing.length) {
    console.warn('  FAIL site-level:');
    for (const item of result.siteMissing) console.warn(`       - ${item}`);
  }
  if (!result.ok) {
    console.error('check-seo: failed (technical SEO / metadata gaps)');
    process.exit(1);
  }
  console.log('check-seo: ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!statSync(ROOT).isDirectory()) {
    console.error('check-seo: root is not a directory');
    process.exit(1);
  }
  main();
}
