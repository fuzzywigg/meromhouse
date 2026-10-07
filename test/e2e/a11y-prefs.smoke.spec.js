import { test, expect } from '@playwright/test';
import { mockGitHubStats } from './helpers.js';

test.describe('prefers-reduced-motion', () => {
  test('clears the green status-dot glow when reduced motion is preferred', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    await expect(page.locator('#site-status')).toHaveText('online', {
      timeout: 10_000,
    });
    await expect(page.locator('#site-dot')).toHaveClass(/green/);

    const boxShadow = await page
      .locator('#site-dot')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).toBe('none');
  });

  test('keeps the green status-dot glow when motion is not reduced', async ({
    page,
  }) => {
    await mockGitHubStats(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');

    await expect(page.locator('#site-status')).toHaveText('online', {
      timeout: 10_000,
    });
    await expect(page.locator('#site-dot')).toHaveClass(/green/);

    const boxShadow = await page
      .locator('#site-dot')
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expect(boxShadow).not.toBe('none');
  });
});

test.describe('noscript smoke', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the GitHub card noscript note without rewriting shell copy', async ({
    page,
  }) => {
    // No route mocks: with JS off the dashboard does not fetch.
    await page.goto('/');

    const note = page.locator('.noscript-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText(/JavaScript is off/i);
    await expect(note).toContainText(/GitHub activity/i);

    // Landmarks still present; do not assert bio/OG meta rewrites.
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('Andrew');
    await expect(page.locator('h1')).toContainText('Pappas');
  });
});
