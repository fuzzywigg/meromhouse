# Release Process

## Pre-release

- Confirm `git status --short` only includes intended changes.
- Check required files: `index.html`, `_headers`, `_redirects`, `functions/api/health.js`, `functions/api/github-stats.js`, `og-image.jpg`.
- Run a local smoke test when changing HTML or Functions.
- Confirm no secrets are present in diffs.

## Deploy

```bash
npx wrangler pages deploy . --project-name=meromhouse
```

## Post-deploy

Smoke test:

```bash
curl -I https://meromhouse.org/
curl -s https://meromhouse.org/api/health
curl -I https://meromhouse.org/og-image.jpg
```

If the custom domain has not cut over yet, run the same checks against the Pages deployment URL.

## Hotfix

1. Make the smallest viable fix.
2. Commit with a conventional commit message.
3. Deploy.
4. Smoke test.
5. Log the deployment in workspace memory.
