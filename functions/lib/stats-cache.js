// Shared freshness rules for /api/github-stats KV entries.
// Shape checks stay in the function; this module owns age honesty.

export const CACHE_TTL_SECONDS = 3600;
export const MAX_CACHE_AGE_MS = CACHE_TTL_SECONDS * 1000;
/** Allow a small future skew so clock drift does not force a miss. */
export const MAX_CACHE_FUTURE_SKEW_MS = 60 * 1000;

/**
 * Return true when cached_at is a usable timestamp within [ -skew, maxAge ].
 * Future timestamps beyond the skew window and ages past maxAge are rejected.
 */
export function isCachedAtFresh(
  cachedAt,
  nowMs = Date.now(),
  maxAgeMs = MAX_CACHE_AGE_MS,
  maxFutureSkewMs = MAX_CACHE_FUTURE_SKEW_MS,
) {
  if (typeof cachedAt !== 'string' || cachedAt.length === 0) return false;
  const parsed = Date.parse(cachedAt);
  if (Number.isNaN(parsed)) return false;
  const ageMs = nowMs - parsed;
  if (ageMs < -maxFutureSkewMs) return false;
  if (ageMs > maxAgeMs) return false;
  return true;
}
