/**
 * DOM-level tests for the interactive dashboard client in index.html.
 * Uses linkedom + node:vm; mocks fetch so CI stays offline.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { parseHTML } from 'linkedom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlSource = readFileSync(join(ROOT, 'index.html'), 'utf8');

function inlineScript(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    if (!/\ssrc\s*=/i.test(match[1] || '')) return match[2];
  }
  throw new Error('no inline dashboard script found');
}

async function flush() {
  // Drain microtasks from setTimeout(0) boot + async fetch handlers.
  for (let i = 0; i < 8; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

function freshCachedAt() {
  return new Date().toISOString();
}

function defaultGitHubBody() {
  return {
    total_stars: 11,
    public_repos: 6,
    followers: 2,
    recent_commits: 3,
    top_repos: [],
    cached_at: freshCachedAt(),
  };
}

function bootDashboard({ github, health, hidden = false } = {}) {
  const { window, document } = parseHTML(htmlSource);
  const fetchCalls = [];
  let hiddenFlag = hidden;

  const fetchMock = async (url, _opts) => {
    fetchCalls.push(String(url));
    if (String(url).includes('/api/github-stats')) {
      if (github?.throw) throw github.throw;
      const status = github?.status ?? 200;
      const body = github?.body ?? defaultGitHubBody();
      return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
          return body;
        },
      };
    }
    if (String(url).includes('/api/health')) {
      if (health?.throw) throw health.throw;
      const status = health?.status ?? 200;
      const body = health?.body ?? {
        ok: true,
        status: 'online',
        updated: freshCachedAt(),
      };
      return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
          return body;
        },
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const intervals = [];
  const timeouts = [];
  const context = {
    document,
    window,
    fetch: fetchMock,
    setInterval(fn, ms) {
      const id = intervals.length + 1;
      intervals.push({ id, fn, ms });
      return id;
    },
    clearInterval(id) {
      const idx = intervals.findIndex((t) => t.id === id);
      if (idx !== -1) intervals.splice(idx, 1);
    },
    // Stack schedules bootLivePolls via setTimeout(…, 0) after first paint.
    setTimeout(fn, ms = 0, ...args) {
      const id = timeouts.length + 1;
      timeouts.push({ id });
      if (ms <= 0) {
        queueMicrotask(() => {
          if (timeouts.some((t) => t.id === id)) fn(...args);
        });
      } else {
        const real = globalThis.setTimeout(() => {
          if (timeouts.some((t) => t.id === id)) fn(...args);
        }, ms);
        timeouts[timeouts.length - 1].real = real;
      }
      return id;
    },
    clearTimeout(id) {
      const idx = timeouts.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const [entry] = timeouts.splice(idx, 1);
      if (entry.real) globalThis.clearTimeout(entry.real);
    },
    AbortController,
    AbortSignal,
    console,
    Date,
    Number,
    JSON,
    Error,
    Array,
    Object,
    Math,
    parseInt,
    isNaN,
    undefined,
  };

  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get() {
      return hiddenFlag;
    },
  });

  const listeners = new Map();
  const originalAdd = document.addEventListener.bind(document);
  document.addEventListener = (type, fn, opts) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
    return originalAdd(type, fn, opts);
  };

  createContext(context);
  runInContext(inlineScript(htmlSource), context);

  return {
    document,
    fetchCalls,
    intervals,
    setHidden(next) {
      hiddenFlag = next;
      for (const fn of listeners.get('visibilitychange') || []) fn();
    },
  };
}

describe('dashboard interactive client', () => {
  it('loads GitHub stats and health into the live regions', async () => {
    const { document, fetchCalls } = bootDashboard();
    await flush();

    assert.ok(fetchCalls.includes('/api/github-stats'));
    assert.ok(fetchCalls.includes('/api/health'));
    assert.equal(document.getElementById('gh-stars').textContent, '11');
    assert.equal(document.getElementById('gh-repos').textContent, '6');
    assert.equal(document.getElementById('gh-commits').textContent, '3');
    assert.equal(document.getElementById('gh-status').textContent, 'ok');
    assert.equal(document.getElementById('site-status').textContent, 'online');
    assert.match(document.getElementById('site-dot').className, /\bgreen\b/);
    assert.match(document.getElementById('gh-dot').className, /\bgreen\b/);
    assert.ok(!document.getElementById('gh-stars').classList.contains('loading'));
  });

  it('shows unavailable GitHub state when the stats API fails', async () => {
    const { document } = bootDashboard({ github: { status: 502, body: { ok: false } } });
    await flush();

    assert.equal(document.getElementById('gh-stars').textContent, 'unavailable');
    assert.equal(document.getElementById('gh-repos').textContent, 'unavailable');
    assert.equal(document.getElementById('gh-commits').textContent, 'unavailable');
    assert.equal(document.getElementById('gh-status').textContent, 'unavailable');
    assert.equal(document.getElementById('last-updated').textContent, 'unavailable');
    assert.match(document.getElementById('gh-dot').className, /\bred\b/);
  });

  it('maps health failure to error state and clears the checked time', async () => {
    const { document } = bootDashboard({ health: { throw: new Error('network') } });
    await flush();

    assert.equal(document.getElementById('site-status').textContent, 'error');
    assert.match(document.getElementById('site-dot').className, /\berror\b/);
    assert.equal(document.getElementById('site-checked').textContent, 'unavailable');
    assert.equal(document.getElementById('site-checked').getAttribute('datetime'), null);
  });

  it('treats ok:true health payloads without status as online', async () => {
    const { document } = bootDashboard({
      health: { body: { ok: true, updated: '2026-10-07T12:00:00.000Z' } },
    });
    await flush();
    assert.equal(document.getElementById('site-status').textContent, 'online');
  });

  it('marks health degraded when updated is missing', async () => {
    const { document } = bootDashboard({
      health: { body: { ok: true, status: 'online' } },
    });
    await flush();
    assert.equal(document.getElementById('site-status').textContent, 'degraded');
    assert.match(document.getElementById('site-dot').className, /\byellow\b/);
  });

  it('starts refresh timers when visible and stops them when hidden', async () => {
    const ui = bootDashboard();
    await flush();
    assert.equal(ui.intervals.length, 2);

    ui.setHidden(true);
    assert.equal(ui.intervals.length, 0);

    const before = ui.fetchCalls.length;
    ui.setHidden(false);
    await flush();
    assert.ok(ui.fetchCalls.length > before, 'visibility resume should refetch');
    assert.equal(ui.intervals.length, 2);
  });

  it('does not start timers when the document starts hidden', async () => {
    const ui = bootDashboard({ hidden: true });
    await flush();
    // Initial refresh/loadHealth still fire once; timers should not.
    assert.equal(ui.intervals.length, 0);
  });
});
