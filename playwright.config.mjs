import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT || 8790);
const baseURL = `http://127.0.0.1:${PORT}`;

/** Shared Chromium launch pins so Cursor VMs and the Playwright Docker image agree. */
const chromiumLaunchArgs = [
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--disable-font-subpixel-positioning',
];

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    // Keep thresholds tight — environment drift is fixed by Docker baselines, not looser diffs.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  webServer: {
    command: `npx --yes wrangler@4 pages dev . --port ${PORT} --ip 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
        launchOptions: {
          args: chromiumLaunchArgs,
        },
      },
    },
  ],
});
