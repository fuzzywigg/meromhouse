#!/usr/bin/env node
/**
 * Report-only document presence check for static HTML pages.
 *
 * For every *.html page under the site root (excluding node_modules, .git,
 * .wrangler, test fixtures), verifies presence of:
 *   - <html lang="..."> (non-empty lang attribute)
 *   - <title>...</title> (non-empty text)
 *   - <meta name="description" ...> (tag present; content not inspected)
 *
 * Does not fetch the network, does not edit files, and does not invent copy.
 * Exit: 0 when every page has all three; 1 when any are missing (CI uses
 * continue-on-error so this stays report-only).
 *
 * Usage: node scripts/check-seo-presence.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  '.git',
  '.wrangler',
  'node_modules',
  'test',
  'docs',
  'scripts',
  'functions',
]);

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
 * Inspect one HTML document for required presence signals.
 * Presence only — does not validate wording quality.
 * @param {string} html
 * @param {string} [label]
 * @returns {{ label: string, ok: boolean, missing: string[] }}
 */
export function inspectSeoPresence(html, label = 'document') {
  const missing = [];

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
  if (!titleMatch || !titleMatch[1].replace(/<[^>]+>/g, '').trim()) {
    missing.push('<title> with non-empty text');
  }

  // Tag present only — do not assert on content wording.
  if (!/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*>/i.test(html)) {
    missing.push('<meta name="description"> tag');
  }

  return { label, ok: missing.length === 0, missing };
}

/**
 * Run presence checks across all discovered pages.
 * @param {string} root
 * @returns {{ ok: boolean, pages: ReturnType<typeof inspectSeoPresence>[], checked: number }}
 */
export function checkSeoPresence(root = ROOT) {
  const files = discoverHtmlPages(root);
  const pages = files.map((abs) => {
    const html = readFileSync(abs, 'utf8');
    return inspectSeoPresence(html, relative(root, abs) || abs);
  });
  return {
    ok: pages.every((p) => p.ok),
    pages,
    checked: pages.length,
  };
}

function main() {
  const result = checkSeoPresence();
  console.log(`check-seo-presence: checked ${result.checked} HTML page(s)`);
  for (const page of result.pages) {
    if (page.ok) {
      console.log(`  ok  ${page.label}`);
    } else {
      console.warn(`  GAP ${page.label}:`);
      for (const item of page.missing) console.warn(`       - missing ${item}`);
    }
  }
  if (!result.ok) {
    console.warn(
      'check-seo-presence: gaps reported (report-only in CI; no copy was written)',
    );
    process.exit(1);
  }
  console.log('check-seo-presence: ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Ensure ROOT is a directory before walking (guards odd cwd invocations).
  if (!statSync(ROOT).isDirectory()) {
    console.error('check-seo-presence: root is not a directory');
    process.exit(1);
  }
  main();
}
