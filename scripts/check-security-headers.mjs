#!/usr/bin/env node
/**
 * Report-only security-header probe for local Worker / Pages responses.
 *
 * Fetches document + API routes from a running (or briefly started) wrangler
 * Pages server and reports missing recommended headers. Does not edit
 * wrangler.toml, _headers, Functions, or secrets.
 *
 * Exit: 0 when every checked route has all recommended headers; 1 on gaps
 * (CI uses continue-on-error so this stays report-only).
 *
 * Usage:
 *   SECURITY_HEADERS_BASE_URL=http://127.0.0.1:8788 node scripts/check-security-headers.mjs
 *   node scripts/check-security-headers.mjs --serve
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Core headers every response class should expose (name → expected value or null = any non-empty). */
export const RECOMMENDED_DOCUMENT_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': null,
  'strict-transport-security': null,
  'content-security-policy-report-only': null,
};

/** Headers recommended on Pages Function (Worker) JSON responses. */
export const RECOMMENDED_WORKER_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': null,
  'strict-transport-security': null,
  // Recommended for clickjacking parity with static _headers; may be absent today.
  'x-frame-options': 'DENY',
};

export const DEFAULT_ROUTES = [
  { path: '/', kind: 'document', headers: RECOMMENDED_DOCUMENT_HEADERS },
  { path: '/api/health', kind: 'worker', headers: RECOMMENDED_WORKER_HEADERS },
  {
    path: '/api/github-stats',
    kind: 'worker',
    headers: RECOMMENDED_WORKER_HEADERS,
  },
];

/**
 * Normalize a Headers / plain-object / raw header map to lower-case keys.
 * @param {Headers | Record<string, string> | Iterable<[string, string]>} input
 * @returns {Record<string, string>}
 */
export function normalizeHeaderMap(input) {
  /** @type {Record<string, string>} */
  const out = {};
  if (input && typeof input.forEach === 'function' && typeof input.get === 'function') {
    /** @type {Headers} */ (input).forEach((value, key) => {
      out[String(key).toLowerCase()] = String(value);
    });
    return out;
  }
  if (input && typeof input[Symbol.iterator] === 'function' && !Array.isArray(input) && typeof input !== 'string') {
    try {
      for (const [key, value] of /** @type {Iterable<[string, string]>} */ (input)) {
        out[String(key).toLowerCase()] = String(value);
      }
      return out;
    } catch {
      // fall through to object path
    }
  }
  for (const [key, value] of Object.entries(input || {})) {
    out[String(key).toLowerCase()] = String(value);
  }
  return out;
}

/**
 * Inspect one response's headers against a recommended map.
 * @param {Record<string, string | null>} recommended
 * @param {Headers | Record<string, string>} actual
 * @param {string} [label]
 * @returns {{ label: string, ok: boolean, missing: string[], mismatches: string[] }}
 */
export function inspectSecurityHeaders(recommended, actual, label = 'response') {
  const map = normalizeHeaderMap(actual);
  /** @type {string[]} */
  const missing = [];
  /** @type {string[]} */
  const mismatches = [];

  for (const [name, expected] of Object.entries(recommended)) {
    const value = map[name];
    if (value == null || !String(value).trim()) {
      missing.push(name);
      continue;
    }
    if (expected != null && String(value).trim() !== expected) {
      mismatches.push(`${name} (got ${JSON.stringify(value)}, want ${JSON.stringify(expected)})`);
    }
  }

  return {
    label,
    ok: missing.length === 0 && mismatches.length === 0,
    missing,
    mismatches,
  };
}

/**
 * Probe routes at baseUrl.
 * @param {string} baseUrl
 * @param {typeof DEFAULT_ROUTES} [routes]
 * @param {(input: string | URL, init?: RequestInit) => Promise<Response>} [fetchImpl]
 */
export async function checkSecurityHeaders(
  baseUrl,
  routes = DEFAULT_ROUTES,
  fetchImpl = fetch,
) {
  const origin = baseUrl.replace(/\/$/, '');
  /** @type {Awaited<ReturnType<typeof inspectSecurityHeaders>>[]} */
  const results = [];

  for (const route of routes) {
    const url = `${origin}${route.path}`;
    let actual = /** @type {Record<string, string>} */ ({});
    let fetchError = '';
    try {
      const res = await fetchImpl(url, { method: 'GET', redirect: 'manual' });
      actual = normalizeHeaderMap(res.headers);
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    }

    if (fetchError) {
      results.push({
        label: `${route.kind} ${route.path}`,
        ok: false,
        missing: [`(fetch failed: ${fetchError})`],
        mismatches: [],
      });
      continue;
    }

    results.push(
      inspectSecurityHeaders(route.headers, actual, `${route.kind} ${route.path}`),
    );
  }

  return {
    ok: results.every((r) => r.ok),
    results,
    checked: results.length,
    baseUrl: origin,
  };
}

/**
 * Wait until /api/health responds.
 * @param {string} baseUrl
 * @param {number} [timeoutMs]
 */
async function waitForServer(baseUrl, timeoutMs = 60_000) {
  const origin = baseUrl.replace(/\/$/, '');
  const deadline = Date.now() + timeoutMs;
  let lastErr = 'timeout';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/api/health`);
      if (res.ok) return;
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`server not ready at ${origin}: ${lastErr}`);
}

/**
 * Start wrangler pages dev, run fn, then stop.
 * @param {(baseUrl: string) => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function withLocalPagesServer(fn) {
  const port = Number(process.env.SECURITY_HEADERS_PORT || 8797);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(
    'npx',
    ['--yes', 'wrangler@4', 'pages', 'dev', '.', '--port', String(port), '--ip', '127.0.0.1'],
    {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    },
  );

  let log = '';
  child.stdout?.on('data', (chunk) => {
    log += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    log += chunk.toString();
  });

  const stop = () =>
    new Promise((resolve) => {
      if (child.killed || child.exitCode != null) {
        resolve();
        return;
      }
      child.once('exit', () => resolve());
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode == null) child.kill('SIGKILL');
      }, 3000).unref?.();
    });

  try {
    await waitForServer(baseUrl);
    return await fn(baseUrl);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${detail}\n--- wrangler log ---\n${log.slice(-4000)}`);
  } finally {
    await stop();
  }
}

function printResult(result) {
  console.log(
    `check-security-headers: checked ${result.checked} route(s) at ${result.baseUrl}`,
  );
  for (const row of result.results) {
    if (row.ok) {
      console.log(`  ok  ${row.label}`);
      continue;
    }
    console.warn(`  GAP ${row.label}:`);
    for (const item of row.missing) console.warn(`       - missing ${item}`);
    for (const item of row.mismatches) console.warn(`       - mismatch ${item}`);
  }
  if (!result.ok) {
    console.warn(
      'check-security-headers: gaps reported (report-only in CI; wrangler/secrets untouched)',
    );
    return 1;
  }
  console.log('check-security-headers: ok');
  return 0;
}

async function main(argv = process.argv.slice(2)) {
  const serve = argv.includes('--serve');
  const baseFromEnv = process.env.SECURITY_HEADERS_BASE_URL || process.env.BASE_URL;

  if (serve || !baseFromEnv) {
    const result = await withLocalPagesServer((baseUrl) =>
      checkSecurityHeaders(baseUrl),
    );
    process.exit(printResult(result));
  }

  const result = await checkSecurityHeaders(baseFromEnv);
  process.exit(printResult(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(
      'check-security-headers:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
