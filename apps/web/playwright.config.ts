import { defineConfig, devices } from '@playwright/test';

import { getWebServerPort } from './env-loader';

const webBaseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${getWebServerPort()}`;

export default defineConfig({
  testDir: './src/__tests__',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  maxFailures: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  use: {
    baseURL: webBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'cd ../.. && bun run dev',
    url: webBaseUrl,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  expect: { timeout: 10_000 },
});
