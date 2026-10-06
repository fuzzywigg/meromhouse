import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/health.js';

describe('GET /api/health', () => {
  it('returns ok, version, and ISO updated timestamp', async () => {
    const res = await onRequest();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'online');
    assert.equal(body.version, '0.1.0');
    assert.equal(typeof body.updated, 'string');
    assert.ok(!Number.isNaN(Date.parse(body.updated)), 'updated should be parseable ISO');
  });
});
