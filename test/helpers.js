/** Minimal mocks for Cloudflare Pages Function unit tests. No live network. */

export function mockRequest(method = 'GET', url = 'https://meromhouse.org/api/github-stats') {
  return new Request(url, { method });
}

export function createMemoryKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value, _opts) {
      store.set(key, value);
    },
  };
}

/**
 * Install a fetch mock for the duration of fn, then restore.
 * handler(url, init) -> Response | Promise<Response>
 */
export async function withMockedFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    return handler(url, init ?? {});
  };
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
