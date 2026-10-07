import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/github-stats.js';
import {
  mockRequest,
  createMemoryKv,
  withMockedFetch,
  jsonResponse,
} from './helpers.js';

const USER = {
  public_repos: 12,
  followers: 34,
};

const REPOS = [
  { name: 'alpha', stargazers_count: 10, fork: false, html_url: 'https://github.com/fuzzywigg/alpha' },
  { name: 'beta', stargazers_count: 5, fork: false, html_url: 'https://github.com/fuzzywigg/beta' },
  { name: 'forked', stargazers_count: 99, fork: true, html_url: 'https://github.com/fuzzywigg/forked' },
  { name: 'gamma', stargazers_count: 7, fork: false, html_url: 'https://github.com/fuzzywigg/gamma' },
];

function monthPushEvents() {
  const now = new Date();
  const midMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
  return [
    {
      type: 'PushEvent',
      created_at: midMonth,
      payload: { commits: [{}, {}, {}] },
    },
    {
      type: 'PushEvent',
      created_at: lastMonth,
      payload: { commits: [{}, {}] },
    },
    {
      type: 'WatchEvent',
      created_at: midMonth,
      payload: {},
    },
  ];
}

function githubFetchHandler(url, init) {
  // Guard: tests must never hit the real network.
  assert.match(url, /^https:\/\/api\.github\.com\//);

  if (url.includes('/users/fuzzywigg/repos')) {
    return jsonResponse(REPOS);
  }
  if (url.includes('/users/fuzzywigg/events')) {
    return jsonResponse(monthPushEvents());
  }
  if (url.includes('/users/fuzzywigg')) {
    return jsonResponse(USER);
  }
  return jsonResponse({ message: 'not mocked' }, 404);
}

describe('GET /api/github-stats', () => {
  it('handles CORS preflight with 204', async () => {
    const res = await onRequest({
      request: mockRequest('OPTIONS'),
      env: {},
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  });

  it('returns KV cache HIT without calling fetch', async () => {
    const cached = JSON.stringify({
      public_repos: 1,
      followers: 2,
      total_stars: 3,
      recent_commits: 4,
      top_repos: [],
      cached_at: new Date().toISOString(),
    });
    const kv = createMemoryKv({ 'github-stats-v1': cached });
    let fetchCalls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error('fetch should not run on cache HIT');
    };

    try {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: { KV: kv },
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'HIT');
      assert.equal(fetchCalls, 0);
      const body = await res.json();
      assert.equal(body.public_repos, 1);
      assert.equal(body.total_stars, 3);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('refetches when the KV entry is age-stale by cached_at', async () => {
    const stale = JSON.stringify({
      public_repos: 1,
      followers: 2,
      total_stars: 3,
      recent_commits: 4,
      top_repos: [],
      cached_at: '2026-01-01T00:00:00.000Z',
    });
    const kv = createMemoryKv({ 'github-stats-v1': stale });
    await withMockedFetch(githubFetchHandler, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: { KV: kv } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'MISS');
      const body = await res.json();
      assert.equal(body.public_repos, 12);
      assert.equal(body.total_stars, 10 + 5 + 99 + 7);
    });
  });

  it('aggregates GitHub stats on cache miss and writes KV', async () => {
    const kv = createMemoryKv();

    await withMockedFetch(githubFetchHandler, async () => {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: { KV: kv },
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'MISS');
      assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');

      const body = await res.json();
      assert.equal(body.public_repos, 12);
      assert.equal(body.followers, 34);
      // forks excluded from top_repos but stars still counted in total
      assert.equal(body.total_stars, 10 + 5 + 99 + 7);
      assert.equal(body.recent_commits, 3);
      assert.deepEqual(
        body.top_repos.map((r) => r.name),
        ['alpha', 'gamma', 'beta'],
      );
      assert.equal(body.top_repos[0].stars, 10);
      assert.equal(typeof body.cached_at, 'string');

      const stored = await kv.get('github-stats-v1');
      assert.ok(stored);
      assert.equal(JSON.parse(stored).total_stars, body.total_stars);
    });
  });

  it('works without KV binding', async () => {
    await withMockedFetch(githubFetchHandler, async () => {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: {},
      });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'MISS');
      const body = await res.json();
      assert.equal(body.ok, undefined);
      assert.equal(body.public_repos, 12);
    });
  });

  it('sends Authorization when env auth value is set', async () => {
    const seen = [];
    await withMockedFetch((url, init) => {
      seen.push(init.headers?.Authorization);
      return githubFetchHandler(url, init);
    }, async () => {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: { GITHUB_TOKEN: 'gh' },
      });
      assert.equal(res.status, 200);
      assert.ok(seen.length >= 3);
      assert.ok(seen.every((h) => h === 'Bearer gh'));
    });
  });

  it('returns 502 when GitHub user API fails', async () => {
    await withMockedFetch((url) => {
      if (url.includes('/users/fuzzywigg/repos') || url.includes('/users/fuzzywigg/events')) {
        return jsonResponse([]);
      }
      return jsonResponse({ message: 'Nope' }, 403);
    }, async () => {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: {},
      });
      assert.equal(res.status, 502);
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /GitHub user API 403/);
    });
  });

  it('follows the repos Link header when summing stars', async () => {
    const seen = [];
    await withMockedFetch((url) => {
      if (url.includes('/users/fuzzywigg/repos')) {
        seen.push(url);
        if (seen.length === 1) {
          return jsonResponse(
            [{ name: 'page1', stargazers_count: 4, fork: false, html_url: 'https://github.com/fuzzywigg/page1' }],
            200,
            { Link: '<https://api.github.com/users/fuzzywigg/repos?per_page=100&page=2>; rel="next"' },
          );
        }
        return jsonResponse([
          { name: 'page2', stargazers_count: 6, fork: false, html_url: 'https://github.com/fuzzywigg/page2' },
        ]);
      }
      return githubFetchHandler(url);
    }, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: {} });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(seen.length, 2);
      assert.equal(body.total_stars, 10);
      assert.deepEqual(body.top_repos.map((r) => r.name), ['page2', 'page1']);
    });
  });

  it('stops repo pagination at the page cap', async () => {
    let repoPages = 0;
    await withMockedFetch((url) => {
      if (url.includes('/users/fuzzywigg/repos')) {
        repoPages += 1;
        return jsonResponse(
          [{ name: `p${repoPages}`, stargazers_count: 1, fork: false, html_url: `https://github.com/fuzzywigg/p${repoPages}` }],
          200,
          { Link: `<https://api.github.com/users/fuzzywigg/repos?per_page=100&page=${repoPages + 1}>; rel="next"` },
        );
      }
      return githubFetchHandler(url);
    }, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: {} });
      const body = await res.json();
      assert.equal(repoPages, 10);
      assert.equal(body.total_stars, 10);
    });
  });

  it('counts payload.size when the commits array is capped', async () => {
    const now = new Date();
    const midMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();
    await withMockedFetch((url) => {
      if (url.includes('/users/fuzzywigg/events')) {
        return jsonResponse([
          {
            type: 'PushEvent',
            created_at: midMonth,
            payload: { size: 25, commits: Array.from({ length: 20 }, () => ({})) },
          },
        ]);
      }
      return githubFetchHandler(url);
    }, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: {} });
      const body = await res.json();
      assert.equal(body.recent_commits, 25);
    });
  });

  it('refetches when the KV entry is not valid stats JSON', async () => {
    const kv = createMemoryKv({ 'github-stats-v1': '{"public_repos":"nope"}' });
    await withMockedFetch(githubFetchHandler, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: { KV: kv } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'MISS');
      const body = await res.json();
      assert.equal(body.public_repos, 12);
      assert.equal(body.total_stars, 10 + 5 + 99 + 7);
    });
  });

  it('does not follow a next link off api.github.com', async () => {
    const seen = [];
    await withMockedFetch((url) => {
      seen.push(url);
      if (url.includes('/users/fuzzywigg/repos')) {
        return jsonResponse(
          [{ name: 'only', stargazers_count: 3, fork: false, html_url: 'https://github.com/fuzzywigg/only' }],
          200,
          { Link: '<https://evil.example/repos?page=2>; rel="next"' },
        );
      }
      return githubFetchHandler(url);
    }, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: {} });
      const body = await res.json();
      assert.equal(body.total_stars, 3);
      assert.equal(seen.some((url) => url.includes('evil.example')), false);
    });
  });

  it('refetches when the KV entry is not JSON', async () => {
    const kv = createMemoryKv({ 'github-stats-v1': 'not-json' });
    await withMockedFetch(githubFetchHandler, async () => {
      const res = await onRequest({ request: mockRequest('GET'), env: { KV: kv } });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('X-Cache'), 'MISS');
      const body = await res.json();
      assert.equal(body.public_repos, 12);
    });
  });

  it('tolerates non-ok repos/events responses', async () => {
    await withMockedFetch((url) => {
      if (url.includes('/repos')) return jsonResponse({ message: 'fail' }, 500);
      if (url.includes('/events')) return jsonResponse({ message: 'fail' }, 500);
      return jsonResponse(USER);
    }, async () => {
      const res = await onRequest({
        request: mockRequest('GET'),
        env: {},
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.total_stars, 0);
      assert.equal(body.recent_commits, 0);
      assert.deepEqual(body.top_repos, []);
      assert.equal(body.public_repos, 12);
    });
  });
});
