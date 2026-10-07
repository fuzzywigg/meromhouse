import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/health.js';
import { createMemoryKv, mockRequest } from './helpers.js';

describe('GET /api/health', () => {
  it('returns ok, online, version, checks, and ISO updated timestamp', async () => {
    const res = await onRequest({ request: mockRequest('GET', 'https://meromhouse.org/api/health'), env: {} });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'online');
    assert.equal(body.version, '0.1.0');
    assert.equal(typeof body.updated, 'string');
    assert.ok(!Number.isNaN(Date.parse(body.updated)), 'updated should be parseable ISO');
    assert.deepEqual(body.checks, { function: 'ok', kv: 'unbound' });
  });

  it('handles CORS preflight with 204', async () => {
    const res = await onRequest({
      request: mockRequest('OPTIONS', 'https://meromhouse.org/api/health'),
      env: {},
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });

  it('marks kv ok when the optional binding answers', async () => {
    const kv = createMemoryKv({ 'github-stats-v1': '{"public_repos":1}' });
    const res = await onRequest({
      request: mockRequest('GET', 'https://meromhouse.org/api/health'),
      env: { KV: kv },
    });
    const body = await res.json();
    assert.equal(body.status, 'online');
    assert.equal(body.checks.kv, 'ok');
  });

  it('degrades when the KV probe errors', async () => {
    const kv = {
      async get() {
        throw new Error('kv unavailable');
      },
    };
    const res = await onRequest({
      request: mockRequest('GET', 'https://meromhouse.org/api/health'),
      env: { KV: kv },
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'degraded');
    assert.equal(body.checks.function, 'ok');
    assert.equal(body.checks.kv, 'error');
  });

  it('degrades when the KV probe times out', async () => {
    const kv = {
      async get() {
        return new Promise(() => {});
      },
    };
    const res = await onRequest({
      request: mockRequest('GET', 'https://meromhouse.org/api/health'),
      env: { KV: kv },
    });
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'degraded');
    assert.equal(body.checks.kv, 'timeout');
  });
});
