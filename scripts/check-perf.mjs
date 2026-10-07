#!/usr/bin/env node
/**
 * Report-only Lighthouse performance / best-practices check for public HTML pages.
 *
 * Always writes test-results/perf/summary.md (+ JSON). Never fails CI: exit code
 * is always 0 after the report is written (or attempted). Soft failures
 * (missing Chrome, audit errors) are recorded in the summary.
 *
 * Usage:
 *   PERF_BASE_URL=http://127.0.0.1:8788 node scripts/check-perf.mjs
 *   node scripts/check-perf.mjs --serve
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'test-results', 'perf');

/** Public HTML document routes (matches sitemap / Playwright DOCUMENT_ROUTES). */
export const PERF_DOCUMENT_ROUTES = ['/'];

export const PERF_FORM_FACTORS = [
  { id: 'mobile', config: null },
  { id: 'desktop', config: desktopConfig },
];

/**
 * @param {number | null | undefined} score 0–1 Lighthouse category score
 * @returns {number | null}
 */
export function scoreToDisplay(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  return Math.round(score * 100);
}

/**
 * @param {import('lighthouse').Result} lhr
 */
export function extractMetrics(lhr) {
  const audits = lhr.audits || {};
  const cats = lhr.categories || {};
  return {
    performance: scoreToDisplay(cats.performance?.score),
    bestPractices: scoreToDisplay(cats['best-practices']?.score),
    accessibility: scoreToDisplay(cats.accessibility?.score),
    seo: scoreToDisplay(cats.seo?.score),
    fcp: audits['first-contentful-paint']?.displayValue ?? null,
    lcp: audits['largest-contentful-paint']?.displayValue ?? null,
    tbt: audits['total-blocking-time']?.displayValue ?? null,
    cls: audits['cumulative-layout-shift']?.displayValue ?? null,
    speedIndex: audits['speed-index']?.displayValue ?? null,
    tti: audits['interactive']?.displayValue ?? null,
  };
}

/**
 * @param {object} summary
 * @returns {string}
 */
export function renderPerfMarkdown(summary) {
  const lines = [
    '# Lighthouse performance summary (report-only)',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    `Base URL: \`${summary.baseUrl}\``,
    '',
    `Tooling: lighthouse@${summary.lighthouseVersion || 'n/a'}`,
    '',
    '| Route | Form factor | Performance | Best practices | FCP | LCP | TBT | CLS |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const row of summary.runs) {
    if (row.error) {
      lines.push(
        `| \`${row.route}\` | ${row.formFactor} | _error_ | _error_ | — | — | — | — |`,
      );
      continue;
    }
    const m = row.metrics;
    lines.push(
      `| \`${row.route}\` | ${row.formFactor} | **${m.performance ?? '—'}** | **${m.bestPractices ?? '—'}** | ${m.fcp ?? '—'} | ${m.lcp ?? '—'} | ${m.tbt ?? '—'} | ${m.cls ?? '—'} |`,
    );
  }

  lines.push('', '## Notes', '');
  if (summary.errors?.length) {
    for (const err of summary.errors) {
      lines.push(`- Error: ${err}`);
    }
  } else {
    lines.push('- No runner errors.');
  }
  lines.push(
    '',
    'This check is **report-only**: scores are recorded here and printed in CI, but they do not fail the job.',
    '',
  );
  return lines.join('\n');
}

/**
 * @param {string} baseUrl
 * @param {{ chromeFlags?: string[] }} [opts]
 */
export async function runPerfAudits(baseUrl, opts = {}) {
  const origin = baseUrl.replace(/\/$/, '');
  /** @type {object[]} */
  const runs = [];
  /** @type {string[]} */
  const errors = [];
  let lighthouseVersion = null;

  const chrome = await chromeLauncher.launch({
    chromeFlags: opts.chromeFlags || ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });

  try {
    for (const route of PERF_DOCUMENT_ROUTES) {
      for (const ff of PERF_FORM_FACTORS) {
        const url = `${origin}${route}`;
        try {
          const flags = {
            port: chrome.port,
            output: 'json',
            logLevel: 'error',
            onlyCategories: ['performance', 'best-practices'],
            // Quiet local Pages: skip HTTPS / PWA noise that is N/A offline.
            skipAudits: ['is-on-https', 'redirects-http', 'uses-http2'],
          };
          const result = await lighthouse(
            url,
            flags,
            ff.config || undefined,
          );
          if (!result?.lhr) throw new Error('empty lighthouse result');
          lighthouseVersion = result.lhr.lighthouseVersion || lighthouseVersion;
          const metrics = extractMetrics(result.lhr);
          runs.push({
            route,
            formFactor: ff.id,
            url,
            metrics,
            fetchTime: result.lhr.fetchTime,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${route} (${ff.id}): ${message}`);
          runs.push({
            route,
            formFactor: ff.id,
            url,
            error: message,
          });
        }
      }
    }
  } finally {
    await chrome.kill();
  }

  return {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    baseUrl: origin,
    lighthouseVersion,
    documentRoutes: [...PERF_DOCUMENT_ROUTES],
    runs,
    errors,
  };
}

/**
 * @param {object} summary
 */
export function writePerfSummary(summary) {
  mkdirSync(OUT_DIR, { recursive: true });
  const jsonPath = join(OUT_DIR, 'summary.json');
  const mdPath = join(OUT_DIR, 'summary.md');
  const markdown = renderPerfMarkdown(summary);
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, markdown, 'utf8');
  return { jsonPath, mdPath, markdown };
}

async function waitForServer(origin, attempts = 60) {
  let lastErr = 'unknown';
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${origin}/api/health`);
      if (res.ok) return;
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready at ${origin}: ${lastErr}`);
}

/**
 * @param {(baseUrl: string) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
async function withLocalPagesServer(fn) {
  const port = Number(process.env.PERF_PORT || 8796);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    'npx',
    ['--yes', 'wrangler@4', 'pages', 'dev', '.', '--port', String(port), '--ip', '127.0.0.1'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    },
  );

  let log = '';
  child.stdout?.on('data', (chunk) => {
    log += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    log += chunk.toString();
  });

  const stop = () =>
    new Promise((resolve) => {
      if (child.killed || child.exitCode != null) {
        resolve();
        return;
      }
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode == null) child.kill('SIGKILL');
      }, 3000).unref?.();
    });

  try {
    await waitForServer(baseUrl);
    return await fn(baseUrl);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${detail}\n--- wrangler log ---\n${log.slice(-4000)}`);
  } finally {
    await stop();
  }
}

async function main(argv = process.argv.slice(2)) {
  const serve = argv.includes('--serve');
  const baseFromEnv = process.env.PERF_BASE_URL || process.env.BASE_URL;

  /** @type {object} */
  let summary;
  try {
    if (serve || !baseFromEnv) {
      summary = await withLocalPagesServer((baseUrl) => runPerfAudits(baseUrl));
    } else {
      summary = await runPerfAudits(baseFromEnv);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary = {
      generatedAt: new Date().toISOString(),
      reportOnly: true,
      baseUrl: baseFromEnv || '(failed to start)',
      lighthouseVersion: null,
      documentRoutes: [...PERF_DOCUMENT_ROUTES],
      runs: [],
      errors: [message],
    };
  }

  const { markdown } = writePerfSummary(summary);
  console.log(`\n${markdown}\n`);
  // Report-only: always succeed so CI never fails on scores or soft errors.
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    // Last-resort: still try to leave a summary and exit 0.
    const message = err instanceof Error ? err.message : String(err);
    try {
      writePerfSummary({
        generatedAt: new Date().toISOString(),
        reportOnly: true,
        baseUrl: '(fatal)',
        lighthouseVersion: null,
        documentRoutes: [...PERF_DOCUMENT_ROUTES],
        runs: [],
        errors: [message],
      });
    } catch {
      // ignore write failures
    }
    console.error('check-perf (report-only):', message);
    process.exit(0);
  });
}
