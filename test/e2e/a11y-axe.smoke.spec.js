import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DOCUMENT_ROUTES, mockGitHubStats } from './helpers.js';

/** Report-only: never fail CI on axe findings; always write JSON + markdown summaries. */
const OUT_DIR = path.join(process.cwd(), 'test-results', 'a11y');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

function summarizeViolations(violations) {
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    help: v.help,
    helpUrl: v.helpUrl,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      failureSummary: n.failureSummary,
    })),
  }));
}

function renderMarkdown(summary) {
  const lines = [
    '# axe-core accessibility summary (report-only)',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Tags: \`${summary.tags.join('`, `')}\``,
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Routes scanned | ${summary.routes.length} |`,
    `| Violations (total) | ${summary.totals.violations} |`,
    `| Incomplete (total) | ${summary.totals.incomplete} |`,
    `| Passes (total) | ${summary.totals.passes} |`,
    '',
  ];

  for (const route of summary.routes) {
    lines.push(`## Route \`${route.route}\``, '');
    lines.push(`- URL: ${route.url}`);
    lines.push(`- Violations: **${route.violationCount}**`);
    lines.push(`- Incomplete: **${route.incompleteCount}**`);
    lines.push(`- Passes: **${route.passCount}**`);
    lines.push('');
    if (route.violations.length === 0) {
      lines.push('_No axe violations._', '');
      continue;
    }
    lines.push('| Impact | Rule | Nodes | Help |', '| --- | --- | ---: | --- |');
    for (const v of route.violations) {
      lines.push(
        `| ${v.impact || 'n/a'} | \`${v.id}\` | ${v.nodes.length} | ${v.help} |`,
      );
    }
    lines.push('');
    for (const v of route.violations) {
      lines.push(`### \`${v.id}\``, '');
      lines.push(v.description, '');
      for (const node of v.nodes) {
        lines.push(`- target: \`${JSON.stringify(node.target)}\``);
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    '',
    'This Playwright check is **report-only**: violations are recorded here and attached to the test report, but they do not fail the job.',
    '',
  );
  return lines.join('\n');
}

test.describe('axe-core accessibility (report-only)', () => {
  test('scan every public HTML page; write JSON/markdown summary; do not fail on violations', async ({
    page,
  }, testInfo) => {
    const routeReports = [];

    for (const route of DOCUMENT_ROUTES) {
      await mockGitHubStats(page);
      await page.goto(route);
      // Settled dashboard shell (health Function + mocked github-stats).
      await expect(page.locator('#site-status')).toHaveText('online', {
        timeout: 10_000,
      });

      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

      routeReports.push({
        route,
        url: results.url,
        violationCount: results.violations.length,
        incompleteCount: results.incomplete.length,
        passCount: results.passes.length,
        violations: summarizeViolations(results.violations),
        incomplete: results.incomplete.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.length,
        })),
      });
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      reportOnly: true,
      tags: AXE_TAGS,
      documentRoutes: DOCUMENT_ROUTES,
      routes: routeReports,
      totals: {
        violations: routeReports.reduce((n, r) => n + r.violationCount, 0),
        incomplete: routeReports.reduce((n, r) => n + r.incompleteCount, 0),
        passes: routeReports.reduce((n, r) => n + r.passCount, 0),
      },
    };

    mkdirSync(OUT_DIR, { recursive: true });
    const jsonPath = path.join(OUT_DIR, 'axe-summary.json');
    const mdPath = path.join(OUT_DIR, 'axe-summary.md');
    const markdown = renderMarkdown(summary);
    writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    writeFileSync(mdPath, markdown, 'utf8');

    await testInfo.attach('axe-summary.json', {
      path: jsonPath,
      contentType: 'application/json',
    });
    await testInfo.attach('axe-summary.md', {
      path: mdPath,
      contentType: 'text/markdown',
    });
    testInfo.annotations.push({
      type: 'a11y-violations',
      description: String(summary.totals.violations),
    });

    // Visible in CI logs without failing the job.
    console.log(`\n${markdown}\n`);

    // Smoke that the report was produced for every public HTML route.
    expect(routeReports.map((r) => r.route)).toEqual([...DOCUMENT_ROUTES]);
    expect(summary.reportOnly).toBe(true);
  });
});
