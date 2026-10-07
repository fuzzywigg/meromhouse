/**
 * Document presence checks: <title>, <meta name="description">, html[lang].
 * Presence / structure only — never asserts on wording and never edits files.
 *
 * Against live site pages this suite is report-only: gaps are emitted via
 * t.diagnostic and the test still passes. Synthetic fixtures assert the
 * scanner logic itself.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkSeoPresence,
  discoverHtmlPages,
  inspectSeoPresence,
} from '../scripts/check-seo-presence.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('SEO presence scanner (fixtures)', () => {
  it('accepts a minimal page with lang, title, and meta description tag', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Example</title>
  <meta name="description" content="x">
</head>
<body></body>
</html>`;
    const result = inspectSeoPresence(html, 'fixture-ok.html');
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
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

  it('treats empty lang and empty title as missing', () => {
    const html = `<!DOCTYPE html>
<html lang="  ">
<head>
  <title>   </title>
  <meta name="description">
</head>
<body></body>
</html>`;
    const result = inspectSeoPresence(html);
    assert.equal(result.ok, false);
    assert.ok(result.missing.some((m) => /lang/i.test(m)));
    assert.ok(result.missing.some((m) => /title/i.test(m)));
  });

  it('only requires the meta description tag to be present', () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Example</title>
  <meta name="description">
</head>
<body></body>
</html>`;
    const result = inspectSeoPresence(html);
    assert.equal(result.ok, true);
  });
});

describe('SEO presence against site pages (report-only)', () => {
  it('discovers at least index.html', () => {
    const pages = discoverHtmlPages(ROOT);
    assert.ok(
      pages.some((p) => p.endsWith('index.html')),
      `expected index.html in ${pages.join(', ')}`,
    );
  });

  it('reports gaps via diagnostics and does not fail the suite', (t) => {
    const result = checkSeoPresence(ROOT);
    assert.ok(result.checked > 0, 'expected at least one HTML page');
    for (const page of result.pages) {
      if (page.ok) {
        t.diagnostic(`seo-presence ok: ${page.label}`);
      } else {
        t.diagnostic(
          `seo-presence GAP (report-only): ${page.label} — missing ${page.missing.join('; ')}`,
        );
      }
    }
    // Report-only: never assert.fail on live pages; wording must not be invented.
    assert.ok(true);
  });
});
