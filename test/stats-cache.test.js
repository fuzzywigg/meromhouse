import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_TTL_SECONDS,
  MAX_CACHE_AGE_MS,
  MAX_CACHE_FUTURE_SKEW_MS,
  isCachedAtFresh,
} from '../functions/lib/stats-cache.js';

describe('stats-cache freshness', () => {
  const now = Date.parse('2026-10-07T12:00:00.000Z');

  it('exports the one-hour KV TTL used by github-stats', () => {
    assert.equal(CACHE_TTL_SECONDS, 3600);
    assert.equal(MAX_CACHE_AGE_MS, 3600 * 1000);
  });

  it('accepts a cached_at within the TTL window', () => {
    const fresh = new Date(now - 30 * 60 * 1000).toISOString();
    assert.equal(isCachedAtFresh(fresh, now), true);
    assert.equal(isCachedAtFresh(new Date(now).toISOString(), now), true);
  });

  it('rejects a cached_at older than the TTL', () => {
    const stale = new Date(now - MAX_CACHE_AGE_MS - 1).toISOString();
    assert.equal(isCachedAtFresh(stale, now), false);
  });

  it('rejects timestamps too far in the future', () => {
    const future = new Date(now + MAX_CACHE_FUTURE_SKEW_MS + 1).toISOString();
    assert.equal(isCachedAtFresh(future, now), false);
  });

  it('allows a small future clock skew', () => {
    const skewed = new Date(now + MAX_CACHE_FUTURE_SKEW_MS).toISOString();
    assert.equal(isCachedAtFresh(skewed, now), true);
  });

  it('rejects non-string and unparseable values', () => {
    assert.equal(isCachedAtFresh(null, now), false);
    assert.equal(isCachedAtFresh('', now), false);
    assert.equal(isCachedAtFresh('not-a-date', now), false);
    assert.equal(isCachedAtFresh(12345, now), false);
  });
});
