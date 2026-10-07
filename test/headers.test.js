import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { onRequest as health } from '../functions/api/health.js';
import { SECURITY_HEADERS } from '../functions/_shared/security-headers.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const headersFile = readFileSync(join(root, '_headers'), 'utf8');

describe('_headers', () => {
  it('declares the expected static-asset security headers', () => {
    assert.match(headersFile, /^\/\*/m);
    assert.match(headersFile, /X-Frame-Options:\s*DENY/);
    assert.match(headersFile, /X-Content-Type-Options:\s*nosniff/);
    assert.match(headersFile, /Referrer-Policy:\s*strict-origin-when-cross-origin/);
    assert.match(headersFile, /Permissions-Policy:\s*.*camera=\(\)/);
    assert.match(headersFile, /Strict-Transport-Security:\s*max-age=31536000;\s*includeSubDomains/);
    assert.match(headersFile, /Content-Security-Policy-Report-Only:/);
    assert.match(headersFile, /script-src 'self' 'unsafe-inline'/);
    assert.match(headersFile, /style-src 'self' 'unsafe-inline'/);
    assert.match(headersFile, /connect-src 'self'/);
    assert.doesNotMatch(headersFile, /Content-Security-Policy(?!-Report-Only)\s*:/);
  });
});

describe('API security headers', () => {
  it('health responses include shared security headers', async () => {
    const res = await health();
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.equal(res.headers.get(name), value, name);
    }
  });
});
