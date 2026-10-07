// CF Pages Function — /api/github-stats
// Fetches GitHub stats for fuzzywigg, caches in KV for 1 hour.
//
// total_stars follows the repos Link header, capped at MAX_REPO_PAGES
// (100 repos per page). recent_commits sums PushEvent payload.size for the
// current calendar month inside the fetched events page. GitHub caps
// payload.commits at 20 and the events API is windowed, so this is not a
// full month history. The card label should say so.
//
// Upstream fetches use a per-request timeout. When the user endpoint succeeds
// but repos and/or events fail or time out, the response is 200 with
// partial: true and is not written to KV.

import { CACHE_TTL_SECONDS, isCachedAtFresh } from '../lib/stats-cache.js';

const GITHUB_USER = 'fuzzywigg';
const CACHE_TTL = CACHE_TTL_SECONDS;
const CACHE_KEY = 'github-stats-v1';
const MAX_REPO_PAGES = 10;
const UPSTREAM_TIMEOUT_MS = 8000;

export async function onRequest(context) {
  const { env } = context;

  // CORS headers for browser fetch
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Try KV cache first. Ignore entries that are not the stats shape.
  if (env.KV) {
    const cached = await env.KV.get(CACHE_KEY);
    const valid = validCachedStats(cached);
    if (valid) {
      return new Response(valid, {
        headers: { ...corsHeaders, 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=300' },
      });
    }
  }

  try {
    const headers = { 'User-Agent': 'meromhouse-dashboard/0.1' };
    if (env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;

    const warnings = [];
    const userPromise = fetchGithub(`https://api.github.com/users/${GITHUB_USER}`, headers);
    const eventsPromise = fetchGithub(
      `https://api.github.com/users/${GITHUB_USER}/events?per_page=100`,
      headers,
    );
    const reposResult = await fetchAllRepos(headers);

    const userRes = await userPromise;
    const eventsRes = await eventsPromise;

    if (!userRes.ok) throw new Error(`GitHub user API ${userRes.status}`);

    const user = await userRes.json();
    let events = [];
    if (eventsRes.ok) {
      const parsed = await eventsRes.json();
      if (Array.isArray(parsed)) {
        events = parsed;
      } else {
        warnings.push('events_shape');
      }
    } else {
      warnings.push(eventsRes.status === 504 ? 'events_timeout' : 'events_upstream');
    }

    const repos = reposResult.repos;
    if (reposResult.warning) warnings.push(reposResult.warning);

    const total_stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

    // Commits visible in the fetched events window for this calendar month.
    // payload.size is the push's real commit count; payload.commits is capped at 20.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const recent_commits = events
      .filter((e) => e.type === 'PushEvent' && e.created_at >= monthStart)
      .reduce((sum, e) => sum + pushCommitCount(e), 0);

    // Top repos by stars
    const top_repos = repos
      .filter((r) => !r.fork)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r) => ({ name: r.name, stars: r.stargazers_count, url: r.html_url }));

    const partial = warnings.length > 0;
    const payload = {
      public_repos: user.public_repos ?? 0,
      followers: user.followers ?? 0,
      total_stars,
      recent_commits,
      top_repos,
      cached_at: new Date().toISOString(),
    };
    if (partial) {
      payload.partial = true;
      payload.warnings = warnings;
    }

    const body = JSON.stringify(payload);

    // Reject writing incomplete upstream results into the hour-long cache.
    if (env.KV && !partial) {
      await env.KV.put(CACHE_KEY, body, { expirationTtl: CACHE_TTL });
    }

    return new Response(body, {
      headers: {
        ...corsHeaders,
        'X-Cache': 'MISS',
        'Cache-Control': partial ? 'no-store' : 'public, max-age=300',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, ok: false }), {
      status: 502,
      headers: { ...corsHeaders, 'Cache-Control': 'no-store' },
    });
  }
}

function validCachedStats(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  // Never serve a partial or error-shaped payload from KV.
  if (data.partial === true || data.ok === false) return null;
  for (const key of ['public_repos', 'followers', 'total_stars', 'recent_commits']) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) return null;
  }
  if (typeof data.cached_at !== 'string' || Number.isNaN(Date.parse(data.cached_at))) return null;
  // KV TTL can lag or be skipped in tests/bindings; never serve age-stale stats.
  if (!isCachedAtFresh(data.cached_at)) return null;
  if (!Array.isArray(data.top_repos)) return null;
  for (const repo of data.top_repos) {
    if (!repo || typeof repo !== 'object') return null;
    if (typeof repo.name !== 'string' || typeof repo.url !== 'string') return null;
    if (typeof repo.stars !== 'number' || !Number.isFinite(repo.stars)) return null;
  }
  return raw;
}

function nextPageUrl(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="?next"?/);
    if (!match) continue;
    try {
      const next = new URL(match[1]);
      if (next.protocol === 'https:' && next.hostname === 'api.github.com') return next.toString();
    } catch {
      /* ignore a malformed Link target */
    }
  }
  return null;
}

async function fetchGithub(url, headers) {
  try {
    return await fetch(url, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isTimeoutError(err, message)) {
      return new Response(JSON.stringify({ message: 'upstream timeout' }), { status: 504 });
    }
    throw err;
  }
}

function isTimeoutError(err, message) {
  if (err && typeof err === 'object' && err.name === 'TimeoutError') return true;
  if (err && typeof err === 'object' && err.name === 'AbortError') return true;
  return /timed? ?out|aborted/i.test(message);
}

async function fetchAllRepos(headers) {
  const repos = [];
  let url = `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`;
  let warning = null;
  for (let page = 0; page < MAX_REPO_PAGES && url; page += 1) {
    let res;
    try {
      res = await fetchGithub(url, headers);
    } catch (err) {
      warning = 'repos_upstream';
      break;
    }
    if (!res.ok) {
      warning = res.status === 504 ? 'repos_timeout' : 'repos_upstream';
      break;
    }
    const batch = await res.json();
    if (!Array.isArray(batch)) {
      warning = 'repos_shape';
      break;
    }
    repos.push(...batch);
    url = nextPageUrl(res.headers.get('Link'));
  }
  return { repos, warning };
}

function pushCommitCount(event) {
  const size = event?.payload?.size;
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) return size;
  const commits = event?.payload?.commits;
  return Array.isArray(commits) ? commits.length : 0;
}
