// Generation + AbortController gate for dashboard polls.
// Used by unit tests; the inline index.html script mirrors this contract.

/**
 * Create a poll session that invalidates in-flight work on begin/invalidate.
 * Superseded or aborted results must not paint "unavailable".
 */
export function createPollSession() {
  let generation = 0;
  let controller = null;

  function invalidate() {
    generation += 1;
    if (controller) {
      controller.abort();
      controller = null;
    }
    return generation;
  }

  function begin() {
    generation += 1;
    if (controller) controller.abort();
    controller = new AbortController();
    const gen = generation;
    const { signal } = controller;
    return {
      gen,
      signal,
      shouldApply() {
        return gen === generation && !signal.aborted;
      },
    };
  }

  return { begin, invalidate, get generation() { return generation; } };
}

/**
 * True when a failed poll should surface an unavailable UI state.
 * Aborts and superseded generations stay quiet (visibility / race honesty).
 */
export function shouldSurfacePollFailure(sessionGen, resultGen, error) {
  if (resultGen !== sessionGen) return false;
  if (error && typeof error === 'object' && error.name === 'AbortError') return false;
  return true;
}
