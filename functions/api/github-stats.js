// CF Pages Function — /api/github-stats
// Fetches GitHub stats for fuzzywigg, caches in KV for 1 hour.

const GITHUB_USER = 'fuzzywigg';
const CACHE_TTL = 3600; // seconds
const CACHE_KEY = 'github-stats-v1';

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

  // Try KV cache first
  if (env.KV) {
    const cached = await env.KV.get(CACHE_KEY);
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'X-Cache': 'HIT', 'Cache-Control': 'public, max-age=300' },
      });
    }
  }

  try {
    const headers = { 'User-Agent': 'meromhouse-dashboard/0.1' };
    if (env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${env.GITHUB_TOKEN}`;

    const [userRes, reposRes, eventsRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USER}`, { headers }),
      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${GITHUB_USER}/events?per_page=100`, { headers }),
    ]);

    if (!userRes.ok) throw new Error(`GitHub user API ${userRes.status}`);

    const user = await userRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const events = eventsRes.ok ? await eventsRes.json() : [];

    // Aggregate stars
    const total_stars = Array.isArray(repos)
      ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
      : 0;

    // Count commits this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const recent_commits = Array.isArray(events)
      ? events.filter(e => e.type === 'PushEvent' && e.created_at >= monthStart)
               .reduce((sum, e) => sum + (e.payload?.commits?.length || 0), 0)
      : 0;

    // Top repos by stars
    const top_repos = Array.isArray(repos)
      ? repos
          .filter(r => !r.fork)
          .sort((a, b) => b.stargazers_count - a.stargazers_count)
          .slice(0, 5)
          .map(r => ({ name: r.name, stars: r.stargazers_count, url: r.html_url }))
      : [];

    const payload = {
      public_repos: user.public_repos ?? 0,
      followers: user.followers ?? 0,
      total_stars,
      recent_commits,
      top_repos,
      cached_at: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);

    if (env.KV) {
      await env.KV.put(CACHE_KEY, body, { expirationTtl: CACHE_TTL });
    }

    return new Response(body, {
      headers: { ...corsHeaders, 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, ok: false }), {
      status: 502,
      headers: corsHeaders,
    });
  }
}
