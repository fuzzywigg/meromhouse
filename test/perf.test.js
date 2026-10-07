/**
 * Fixture coverage for the report-only Lighthouse summarizer.
 * Does not launch Chrome or wrangler (live path: npm run check:perf).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERF_DOCUMENT_ROUTES,
  scoreToDisplay,
  extractMetrics,
  renderPerfMarkdown,
} from '../scripts/check-perf.mjs';

describe('check-perf helpers', () => {
  it('lists the public HTML document routes', () => {
    assert.deepEqual(PERF_DOCUMENT_ROUTES, ['/']);
  });

  it('maps lighthouse 0–1 scores to display integers', () => {
    assert.equal(scoreToDisplay(1), 100);
    assert.equal(scoreToDisplay(0.94), 94);
    assert.equal(scoreToDisplay(null), null);
    assert.equal(scoreToDisplay(undefined), null);
  });

  it('extracts category and CWV display metrics from an lhr-shaped object', () => {
    const metrics = extractMetrics({
      categories: {
        performance: { score: 1 },
        'best-practices': { score: 0.96 },
        accessibility: { score: 1 },
        seo: { score: 1 },
      },
      audits: {
        'first-contentful-paint': { displayValue: '0.7 s' },
        'largest-contentful-paint': { displayValue: '1.0 s' },
        'total-blocking-time': { displayValue: '10 ms' },
        'cumulative-layout-shift': { displayValue: '0' },
        'speed-index': { displayValue: '0.7 s' },
        interactive: { displayValue: '1.0 s' },
      },
    });
    assert.equal(metrics.performance, 100);
    assert.equal(metrics.bestPractices, 96);
    assert.equal(metrics.fcp, '0.7 s');
    assert.equal(metrics.lcp, '1.0 s');
    assert.equal(metrics.tbt, '10 ms');
  });

  it('renders report-only markdown including soft errors', () => {
    const md = renderPerfMarkdown({
      generatedAt: '2026-10-07T00:00:00.000Z',
      baseUrl: 'http://127.0.0.1:8796',
      lighthouseVersion: '12.8.2',
      runs: [
        {
          route: '/',
          formFactor: 'mobile',
          metrics: {
            performance: 100,
            bestPractices: 100,
            fcp: '0.7 s',
            lcp: '1.0 s',
            tbt: '10 ms',
            cls: '0',
          },
        },
        {
          route: '/',
          formFactor: 'desktop',
          error: 'chrome missing',
        },
      ],
      errors: ['chrome missing'],
    });
    assert.match(md, /report-only/i);
    assert.match(md, /\*\*100\*\*/);
    assert.match(md, /_error_/);
    assert.match(md, /Error: chrome missing/);
  });
});
