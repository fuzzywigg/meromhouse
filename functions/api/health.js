// CF Pages Function — /api/health
// Liveness for the dashboard uptime card. Optionally probes KV when bound.
// Never calls GitHub (github-stats owns that path). Callers map status
// "online"/"degraded"/"error", ok:false, or a failed/timed-out fetch.

const VERSION = '0.1.0';
const KV_PROBE_TIMEOUT_MS = 1500;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

export async function onRequest(context) {
  if (context?.request?.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const checks = { function: 'ok' };
  let status = 'online';

  const kv = context?.env?.KV;
  if (kv) {
    try {
      await withTimeout(kv.get('github-stats-v1'), KV_PROBE_TIMEOUT_MS, 'KV probe timed out');
      checks.kv = 'ok';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.kv = /timed out/i.test(message) ? 'timeout' : 'error';
      status = 'degraded';
    }
  } else {
    checks.kv = 'unbound';
  }

  return Response.json(
    {
      ok: true,
      status,
      version: VERSION,
      updated: new Date().toISOString(),
      checks,
    },
    { headers: corsHeaders },
  );
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
