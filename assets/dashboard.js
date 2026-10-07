  const GITHUB_STATS_URL = '/api/github-stats';
  const REFRESH_MS = 5 * 60 * 1000; // 5 min
  let refreshTimer = null;

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) { el.textContent = val; el.classList.remove('loading'); }
  }

  function setGitHubDot(state) {
    const dot = document.getElementById('gh-dot');
    if (!dot) return;
    dot.classList.remove('loading', 'green', 'red');
    if (state) dot.classList.add(state);
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

  async function loadGitHub() {
    try {
      const res = await fetch(GITHUB_STATS_URL);
      if (!res.ok) throw new Error('API error');
      const d = await res.json();
      setEl('gh-stars', d.total_stars ?? '—');
      setEl('gh-repos', d.public_repos ?? '—');
      setEl('gh-commits', d.recent_commits ?? '—');
      setEl('gh-status', 'ok');
      showCachedAt(d.cached_at);
      setGitHubDot('green');
    } catch {
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

  const HEALTH_URL = '/api/health';
  let healthTimer = null;

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
    try {
      const res = await fetch(HEALTH_URL);
      if (!res.ok) throw new Error('health http');
      const data = await res.json();
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
    } catch {
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
      return;
    }
    refresh();
    startRefreshTimer();
    loadHealth();
    startHealthTimer();
  });

  refresh();
  startRefreshTimer();
  loadHealth();
  startHealthTimer();
