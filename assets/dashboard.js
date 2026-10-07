  const GITHUB_STATS_URL = '/api/github-stats';
  const HEALTH_URL = '/api/health';
  const REFRESH_MS = 5 * 60 * 1000; // 5 min
  const CLIENT_FETCH_TIMEOUT_MS = 10000;
  // Match server KV TTL; age-stale payloads paint unavailable instead of old numbers.
  const STATS_MAX_AGE_MS = 3600 * 1000;
  let refreshTimer = null;
  let healthTimer = null;

  // Generation + AbortController gates (mirrors functions/lib/poll-session.js).
  // Visibility flips and overlapping refreshes must not paint a superseded result.
  let githubPollGen = 0;
  let githubPollController = null;
  let healthPollGen = 0;
  let healthPollController = null;

  function beginPoll(kind) {
    if (kind === 'github') {
      githubPollGen += 1;
      if (githubPollController) githubPollController.abort();
      githubPollController = new AbortController();
      return { gen: githubPollGen, signal: githubPollController.signal };
    }
    healthPollGen += 1;
    if (healthPollController) healthPollController.abort();
    healthPollController = new AbortController();
    return { gen: healthPollGen, signal: healthPollController.signal };
  }

  function invalidatePolls() {
    githubPollGen += 1;
    healthPollGen += 1;
    if (githubPollController) {
      githubPollController.abort();
      githubPollController = null;
    }
    if (healthPollController) {
      healthPollController.abort();
      healthPollController = null;
    }
  }

  function shouldApplyGitHub(gen, signal) {
    return gen === githubPollGen && !signal.aborted;
  }

  function shouldApplyHealth(gen, signal) {
    return gen === healthPollGen && !signal.aborted;
  }

  function shouldSurfaceFailure(currentGen, resultGen, err) {
    if (resultGen !== currentGen) return false;
    if (err && err.name === 'AbortError') return false;
    return true;
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.classList.remove('loading'); }
  }

  function setGitHubDot(state) {
    const dot = document.getElementById('gh-dot');
    if (!dot) return;
    dot.classList.remove('loading', 'green', 'yellow', 'red');
    if (state) dot.classList.add(state);
  }

  function isFreshCachedAt(cachedAt) {
    if (typeof cachedAt !== 'string') return false;
    const parsed = Date.parse(cachedAt);
    if (Number.isNaN(parsed)) return false;
    const ageMs = Date.now() - parsed;
    return ageMs >= -60000 && ageMs <= STATS_MAX_AGE_MS;
  }

  function showCachedAt(cachedAt) {
    const el = document.getElementById('last-updated');
    if (!el) return;
    const parsed = cachedAt ? new Date(cachedAt) : null;
    el.textContent = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleString()
      : 'unavailable';
  }

  function showGitHubUnavailable() {
    setEl('gh-stars', 'unavailable');
    setEl('gh-repos', 'unavailable');
    setEl('gh-commits', 'unavailable');
    setEl('gh-status', 'unavailable');
    showCachedAt(null);
    setGitHubDot('red');
  }

  // Reject a response that is not the stats shape (same rules as KV cache).
  function validGitHubStats(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.ok === false) return false;
    for (const key of ['public_repos', 'followers', 'total_stars', 'recent_commits']) {
      if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) return false;
    }
    if (typeof data.cached_at !== 'string' || Number.isNaN(Date.parse(data.cached_at))) return false;
    if (!Array.isArray(data.top_repos)) return false;
    return true;
  }

  async function loadGitHub() {
    const { gen, signal } = beginPoll('github');
    try {
      const res = await fetch(GITHUB_STATS_URL, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS)]),
        priority: 'low',
      });
      if (!res.ok) throw new Error('API error');
      const d = await res.json();
      if (!shouldApplyGitHub(gen, signal)) return;
      if (!validGitHubStats(d)) throw new Error('bad stats shape');
      if (!isFreshCachedAt(d.cached_at)) throw new Error('stale cached_at');
      setEl('gh-stars', d.total_stars);
      setEl('gh-repos', d.public_repos);
      setEl('gh-commits', d.recent_commits);
      if (d.partial === true) {
        setEl('gh-status', 'partial');
        setGitHubDot('yellow');
      } else {
        setEl('gh-status', 'ok');
        setGitHubDot('green');
      }
      showCachedAt(d.cached_at);
    } catch (err) {
      if (!shouldSurfaceFailure(githubPollGen, gen, err)) return;
      showGitHubUnavailable();
    }
  }

  function stopRefreshTimer() {
    if (refreshTimer !== null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  function startRefreshTimer() {
    if (refreshTimer !== null || document.hidden) return;
    refreshTimer = setInterval(refresh, REFRESH_MS);
  }

  async function refresh() {
    await loadGitHub();
  }

  function setSiteDot(state) {
    const dot = document.getElementById('site-dot');
    if (!dot) return;
    dot.classList.remove('loading', 'green', 'yellow', 'red', 'error', 'link');
    if (state === 'online') dot.classList.add('green');
    else if (state === 'degraded') dot.classList.add('yellow');
    else dot.classList.add('error');
  }

  function showSiteChecked(iso) {
    const el = document.getElementById('site-checked');
    if (!el) return;
    const parsed = typeof iso === 'string' ? new Date(iso) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      el.dateTime = parsed.toISOString();
      el.textContent = parsed.toLocaleString();
      return;
    }
    el.removeAttribute('datetime');
    el.textContent = 'unavailable';
  }

  async function loadHealth() {
    const { gen, signal } = beginPoll('health');
    try {
      const res = await fetch(HEALTH_URL, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS)]),
        priority: 'low',
      });
      if (!res.ok) throw new Error('health http');
      const data = await res.json();
      if (!shouldApplyHealth(gen, signal)) return;
      let state = 'error';
      if (data.status === 'online' || data.status === 'degraded' || data.status === 'error') {
        state = data.status;
      } else if (data.ok === true) {
        state = 'online';
      } else if (data.ok === false) {
        state = 'degraded';
      }
      if (state !== 'error' && (typeof data.updated !== 'string' || Number.isNaN(Date.parse(data.updated)))) {
        state = 'degraded';
      }
      setEl('site-status', state);
      setSiteDot(state);
      showSiteChecked(data.updated);
    } catch (err) {
      if (!shouldSurfaceFailure(healthPollGen, gen, err)) return;
      setEl('site-status', 'error');
      setSiteDot('error');
      showSiteChecked(null);
    }
  }

  function stopHealthTimer() {
    if (healthTimer === null) return;
    clearInterval(healthTimer);
    healthTimer = null;
  }

  function startHealthTimer() {
    if (healthTimer !== null || document.hidden) return;
    healthTimer = setInterval(loadHealth, REFRESH_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRefreshTimer();
      stopHealthTimer();
      // Drop in-flight work so a late response cannot paint after hide/show.
      invalidatePolls();
      return;
    }
    refresh();
    startRefreshTimer();
    loadHealth();
    startHealthTimer();
  });

  function bootLivePolls() {
    refresh();
    startRefreshTimer();
    loadHealth();
    startHealthTimer();
  }

  // After first paint so /api/* fetches are not on the critical navigation chain.
  function scheduleLivePolls() {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        setTimeout(bootLivePolls, 0);
      });
      return;
    }
    setTimeout(bootLivePolls, 0);
  }

  scheduleLivePolls();
