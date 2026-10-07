/**
 * Security-header probe: fixture coverage for the scanner, plus a report-only
 * live-suite path that never fails the unit job on Worker gaps.
 *
 * Live Worker probing belongs to `npm run check:security-headers` (CI
 * continue-on-error). This file does not start wrangler and does not edit config.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOMMENDED_DOCUMENT_HEADERS,
  RECOMMENDED_WORKER_HEADERS,
  checkSecurityHeaders,
  inspectSecurityHeaders,
  normalizeHeaderMap,
} from '../scripts/check-security-headers.mjs';

describe('security-headers scanner (fixtures)', () => {
  it('normalizes header names to lowercase', () => {
    const map = normalizeHeaderMap({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    assert.equal(map['x-content-type-options'], 'nosniff');
    assert.equal(map['referrer-policy'], 'strict-origin-when-cross-origin');
  });

  it('accepts a complete Worker header set', () => {
    const result = inspectSecurityHeaders(
      RECOMMENDED_WORKER_HEADERS,
      {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Frame-Options': 'DENY',
      },
      'fixture-worker-ok',
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.mismatches, []);
  });

  it('reports missing Worker headers without mutating anything', () => {
    const result = inspectSecurityHeaders(
      RECOMMENDED_WORKER_HEADERS,
      { 'X-Content-Type-Options': 'nosniff' },
      'fixture-worker-gaps',
    );
    assert.equal(result.ok, false);
    assert.ok(result.missing.includes('referrer-policy'));
    assert.ok(result.missing.includes('permissions-policy'));
    assert.ok(result.missing.includes('strict-transport-security'));
    assert.ok(result.missing.includes('x-frame-options'));
  });

  it('flags exact-value mismatches on document headers', () => {
    const result = inspectSecurityHeaders(
      RECOMMENDED_DOCUMENT_HEADERS,
      {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
        'permissions-policy': 'camera=()',
        'strict-transport-security': 'max-age=1',
        'content-security-policy-report-only': "default-src 'self'",
      },
    );
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => /referrer-policy/i.test(m)));
  });

  it('checkSecurityHeaders aggregates mock fetch routes', async () => {
    const headersByPath = {
      '/': {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'x-frame-options': 'DENY',
        'permissions-policy': 'camera=()',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'content-security-policy-report-only': "default-src 'self'",
      },
      '/api/health': {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=()',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        // Intentionally omit x-frame-options to exercise gap reporting.
      },
      '/api/github-stats': {
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=()',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'DENY',
      },
    };

    const fetchImpl = async (url) => {
      const path = new URL(url).pathname;
      const headers = headersByPath[path] || {};
      return {
        headers: {
          forEach(cb) {
            for (const [k, v] of Object.entries(headers)) cb(v, k);
          },
          get(name) {
            return headers[String(name).toLowerCase()] ?? null;
          },
        },
      };
    };

    const result = await checkSecurityHeaders(
      'http://127.0.0.1:9',
      undefined,
      fetchImpl,
    );
    assert.equal(result.checked, 3);
    assert.equal(result.ok, false);
    const health = result.results.find((r) => r.label.includes('/api/health'));
    assert.ok(health);
    assert.equal(health.ok, false);
    assert.ok(health.missing.includes('x-frame-options'));
  });
});

describe('security-headers recommendations (report-only documentation)', () => {
  it('documents Worker recommendations including x-frame-options', () => {
    assert.equal(RECOMMENDED_WORKER_HEADERS['x-frame-options'], 'DENY');
    assert.equal(RECOMMENDED_WORKER_HEADERS['x-content-type-options'], 'nosniff');
  });

  it('documents CSP-Report-Only for document responses only', () => {
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        RECOMMENDED_DOCUMENT_HEADERS,
        'content-security-policy-report-only',
      ),
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        RECOMMENDED_WORKER_HEADERS,
        'content-security-policy-report-only',
      ),
      false,
    );
  });

  it('report-only placeholder: live Worker gaps are CI continue-on-error', (t) => {
    // Unit job stays green; `npm run check:security-headers` is the live probe.
    t.diagnostic(
      'security-headers: live Worker probe is report-only via CI continue-on-error',
    );
    assert.ok(true);
  });
});
