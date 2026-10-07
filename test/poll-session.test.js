import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPollSession, shouldSurfacePollFailure } from '../functions/lib/poll-session.js';

describe('poll-session race gate', () => {
  it('begin bumps generation and aborts the previous controller', () => {
    const session = createPollSession();
    const first = session.begin();
    assert.equal(first.gen, 1);
    assert.equal(first.signal.aborted, false);

    const second = session.begin();
    assert.equal(second.gen, 2);
    assert.equal(first.signal.aborted, true);
    assert.equal(second.signal.aborted, false);
    assert.equal(first.shouldApply(), false);
    assert.equal(second.shouldApply(), true);
  });

  it('invalidate drops in-flight work without starting a new fetch', () => {
    const session = createPollSession();
    const inflight = session.begin();
    const genAfter = session.invalidate();
    assert.equal(genAfter, 2);
    assert.equal(inflight.signal.aborted, true);
    assert.equal(inflight.shouldApply(), false);
  });

  it('shouldSurfacePollFailure stays quiet for abort and superseded gens', () => {
    assert.equal(shouldSurfacePollFailure(2, 1, new Error('API error')), false);
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    assert.equal(shouldSurfacePollFailure(3, 3, abortErr), false);
    assert.equal(shouldSurfacePollFailure(3, 3, new Error('API error')), true);
  });

  it('rapid begin calls leave only the latest generation applicable', () => {
    const session = createPollSession();
    const a = session.begin();
    const b = session.begin();
    const c = session.begin();
    assert.equal(a.shouldApply(), false);
    assert.equal(b.shouldApply(), false);
    assert.equal(c.shouldApply(), true);
    assert.equal(session.generation, 3);
  });
});
