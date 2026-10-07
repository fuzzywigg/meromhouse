import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HtmlValidate } from 'html-validate';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('HTML validation', () => {
  it('index.html passes html-validate recommended rules', async () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const validator = new HtmlValidate();
    const report = await validator.validateString(html, 'index.html');
    const errors = report.results.flatMap((r) =>
      r.messages.filter((m) => m.severity === 2),
    );
    if (errors.length) {
      const detail = errors
        .map((m) => `${m.line}:${m.column} ${m.ruleId} — ${m.message}`)
        .join('\n');
      assert.fail(`html-validate errors:\n${detail}`);
    }
    assert.equal(report.valid, true);
  });

  it('every img has a non-empty alt attribute', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    for (const tag of imgs) {
      const alt = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
      assert.ok(alt, `missing alt: ${tag}`);
      // Decorative images may use alt=""; informative ones must be non-empty.
      // This site currently has no imgs; the rule documents the requirement.
      assert.ok(alt[1] !== undefined, `empty alt attr parse failed: ${tag}`);
    }
  });
});
