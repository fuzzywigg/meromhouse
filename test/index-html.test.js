import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const deploy = readFileSync(join(root, 'DEPLOY.md'), 'utf8');
const dashboardJs = readFileSync(join(root, 'assets', 'dashboard.js'), 'utf8');

describe('index.html', () => {
  it('has an element for every id the dashboard script uses', () => {
    const ids = new Set();
    const re = /(?:getElementById|setEl)\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = re.exec(dashboardJs))) ids.add(match[1]);
    assert.ok(ids.size > 0, 'expected the script to reference element ids');
    for (const id of ids) {
      assert.match(html, new RegExp(`\\sid=["']${id}["']`), `missing element id ${id}`);
    }
  });

  it('loads dashboard.js with defer and no third-party script src', () => {
    assert.match(html, /<script\b[^>]*\ssrc=["']\/assets\/dashboard\.js["'][^>]*\sdefer\b/i);
    const re = /<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = re.exec(html))) {
      const src = match[1];
      assert.doesNotMatch(src, /^\/\//, src);
      if (/^https?:\/\//i.test(src)) {
        const host = new URL(src).host;
        assert.ok(host === 'meromhouse.org' || host === 'www.meromhouse.org', src);
      }
    }
  });

  it('sets rel=noopener noreferrer on every external link', () => {
    const re = /<a\b[^>]*>/gi;
    let match;
    let seen = 0;
    while ((match = re.exec(html))) {
      const tag = match[0];
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
      if (!href || !/^https?:\/\//i.test(href[1])) continue;
      seen += 1;
      assert.match(tag, /\brel\s*=\s*["'][^"']*\bnoopener\b/i, tag);
      assert.match(tag, /\brel\s*=\s*["'][^"']*\bnoreferrer\b/i, tag);
    }
    assert.ok(seen > 0, 'expected external links');
  });

  it('includes description, Open Graph, and Twitter meta tags', () => {
    const required = [
      /<meta\s+name=["']description["']/i,
      /<meta\s+name=["']theme-color["']\s+content=["']#0d1117["']/i,
      /<link\s+rel=["']canonical["']\s+href=["']https:\/\/meromhouse\.org\/["']/i,
      /<meta\s+property=["']og:title["']/i,
      /<meta\s+property=["']og:description["']/i,
      /<meta\s+property=["']og:url["']/i,
      /<meta\s+property=["']og:type["']/i,
      /<meta\s+property=["']og:locale["']/i,
      /<meta\s+property=["']og:image["']/i,
      /<meta\s+property=["']og:image:width["']\s+content=["']1200["']/i,
      /<meta\s+property=["']og:image:height["']\s+content=["']630["']/i,
      /<meta\s+property=["']og:image:alt["']/i,
      /<link\s+rel=["']apple-touch-icon["']/i,
      /<meta\s+name=["']twitter:card["']/i,
      /<meta\s+name=["']twitter:title["']/i,
      /<meta\s+name=["']twitter:description["']/i,
      /<meta\s+name=["']twitter:image["']/i,
      /<meta\s+name=["']twitter:image:alt["']/i,
    ];
    for (const pattern of required) assert.match(html, pattern);
  });

  it('keeps research title as an h3 under the card h2', () => {
    assert.match(
      html,
      /<h2\b[^>]*\bid=["']card-research["'][^>]*>[\s\S]*?<h3\b[^>]*class=["'][^"']*\bresearch-title\b/i,
    );
  });

  it('landmarks profile links in a labelled nav', () => {
    assert.match(
      html,
      /<nav\b[^>]*class=["'][^"']*\bheader-meta\b[^"']*["'][^>]*\baria-label=["']Profile links["']/i,
    );
  });

  it('offers a skip link to main and labels each card with an h2', () => {
    assert.match(html, /<a\b[^>]*class=["'][^"']*\bskip-link\b[^"']*["'][^>]*href=["']#main["']/i);
    assert.match(html, /<main\b[^>]*\bid=["']main["']/i);
    const headings = [...html.matchAll(/<h2\b[^>]*\bid=["'](card-[^"']+)["'][^>]*>([^<]+)<\/h2>/gi)];
    assert.equal(headings.length, 6, 'expected six card h2 headings');
    for (const [, id] of headings) {
      assert.match(
        html,
        new RegExp(`<section\\b[^>]*aria-labelledby=["']${id}["']`, 'i'),
        `missing section for ${id}`,
      );
    }
  });

  it('hides decorative status dots and card icons from assistive tech', () => {
    const icons = [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bcard-icon\b[^"']*["'][^>]*>/gi)];
    assert.ok(icons.length >= 6, 'expected card icons');
    for (const [tag] of icons) {
      assert.match(tag, /\baria-hidden=["']true["']/i, tag);
    }

    const dots = [...html.matchAll(/<span\b[^>]*class=["'][^"']*\bstatus-dot\b[^"']*["'][^>]*>/gi)];
    assert.ok(dots.length >= 3, 'expected status dots');
    for (const [tag] of dots) {
      assert.match(tag, /\baria-hidden=["']true["']/i, tag);
    }
  });

  it('keeps narrow layouts from forcing single-line flex rows', () => {
    assert.match(html, /\.header-meta\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /\.card-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /\.project-row\s*\{[^}]*flex-wrap:\s*wrap/s);
    assert.match(html, /grid-template-columns:\s*repeat\(\s*auto-fill,\s*minmax\(\s*min\(\s*320px,\s*100%\s*\)/i);
  });

  it('labels the refresh timestamp as GitHub-only', () => {
    assert.match(html, /GitHub last updated:\s*<span\b[^>]*\bid=["']last-updated["']/i);
    assert.doesNotMatch(html, /\|\s*Last updated:/i);
  });

  it('puts #refresh-bar in a labelled landmark and underlines card-row links', () => {
    assert.match(
      html,
      /<aside\b[^>]*\bid=["']refresh-bar["'][^>]*\baria-label=["'][^"']*["']/i,
    );
    assert.match(html, /\.card-row-value\s+a\s*\{[^}]*text-decoration:\s*underline/s);
  });

  it('preloads critical fonts and serves modern image formats with dimensions', () => {
    assert.match(html, /rel=["']preload["'][^>]*as=["']font["']/i);
    assert.match(html, /source-sans-3-latin-400-normal\.woff2/);
    assert.match(html, /<picture>[\s\S]*og-image-600\.avif[\s\S]*og-image-600\.webp[\s\S]*<\/picture>/i);
    assert.match(
      html,
      /<img\b[^>]*\bwidth=["']320["'][^>]*\bheight=["']168["'][^>]*\bloading=["']lazy["']/i,
    );
  });

  it('pauses GitHub and health polling while the tab is hidden', () => {
    assert.match(dashboardJs, /document\.addEventListener\(\s*['"]visibilitychange['"]/);
    assert.match(dashboardJs, /if\s*\(\s*document\.hidden\s*\)\s*\{[\s\S]*stopRefreshTimer\(\);[\s\S]*stopHealthTimer\(\);/);
    assert.match(dashboardJs, /function\s+startRefreshTimer\s*\(\s*\)\s*\{[\s\S]*document\.hidden/);
    assert.match(dashboardJs, /function\s+startHealthTimer\s*\(\s*\)\s*\{[\s\S]*document\.hidden/);
    assert.match(dashboardJs, /healthTimer\s*=\s*setInterval\(\s*loadHealth\s*,\s*REFRESH_MS\s*\)/);
    assert.match(dashboardJs, /refreshTimer\s*=\s*setInterval\(\s*refresh\s*,\s*REFRESH_MS\s*\)/);
  });

  it('schedules live polls after first paint and marks fetches low priority', () => {
    assert.match(dashboardJs, /function\s+bootLivePolls\s*\(/);
    assert.match(dashboardJs, /function\s+scheduleLivePolls\s*\(/);
    assert.match(dashboardJs, /requestAnimationFrame/);
    assert.match(dashboardJs, /scheduleLivePolls\s*\(\s*\)\s*;/);
    assert.match(dashboardJs, /priority:\s*['"]low['"]/);
  });

  it('times out health and github-stats fetches and rejects a bad stats shape', () => {
    assert.match(dashboardJs, /CLIENT_FETCH_TIMEOUT_MS\s*=\s*10000/);
    assert.match(dashboardJs, /AbortSignal\.timeout\(CLIENT_FETCH_TIMEOUT_MS\)/);
    assert.match(dashboardJs, /function validGitHubStats\s*\(/);
    assert.match(dashboardJs, /d\.partial\s*===\s*true/);
    assert.match(dashboardJs, /setEl\('gh-status',\s*'partial'\)/);
  });

  it('gates polls with generation + AbortController and rejects stale cached_at', () => {
    assert.match(dashboardJs, /function\s+beginPoll\s*\(/);
    assert.match(dashboardJs, /function\s+invalidatePolls\s*\(/);
    assert.match(dashboardJs, /function\s+shouldSurfaceFailure\s*\(/);
    assert.match(dashboardJs, /new\s+AbortController\s*\(/);
    assert.match(
      dashboardJs,
      /AbortSignal\.any\(\s*\[\s*signal\s*,\s*AbortSignal\.timeout\(CLIENT_FETCH_TIMEOUT_MS\)\s*\]\s*\)/,
    );
    assert.match(dashboardJs, /fetch\(\s*GITHUB_STATS_URL\s*,/);
    assert.match(dashboardJs, /fetch\(\s*HEALTH_URL\s*,/);
    assert.match(dashboardJs, /isFreshCachedAt\s*\(\s*d\.cached_at\s*\)/);
    assert.match(dashboardJs, /STATS_MAX_AGE_MS\s*=\s*3600\s*\*\s*1000/);
    assert.match(dashboardJs, /err\.name\s*===\s*['"]AbortError['"]/);
    assert.match(
      dashboardJs,
      /if\s*\(\s*document\.hidden\s*\)\s*\{[\s\S]*invalidatePolls\(\);/,
    );
    assert.match(dashboardJs, /showGitHubUnavailable\s*\(/);
  });
});

describe('docs: live poll pause-when-hidden', () => {
  it('documents /api/health polling only while the tab is visible', () => {
    assert.match(
      readme,
      /fetch \/api\/health<br\/>while the tab is visible/,
    );
    assert.match(
      readme,
      /`\/api\/health`\s*\|\s*Live same-origin fetch every 5 minutes while the tab is visible;\s*paused when the tab is hidden/i,
    );
    assert.match(
      readme,
      /Both live polls use a 5-minute interval and pause on `visibilitychange` when `document\.hidden` is true/i,
    );
    assert.match(deploy, /\/api\/health` every 5 minutes while the tab is visible;\s*both pause when the tab is hidden/i);
  });
});
