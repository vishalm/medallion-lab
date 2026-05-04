import { defineConfig, devices } from '@playwright/test';

// run.sh boots the FastAPI backend on :8000 before invoking Playwright.
// FastAPI also serves the built SPA from app/frontend/dist (see Dockerfile
// CMD + STATIC_DIR config), so a single host serves both the API and the
// React app. That keeps Playwright config minimal: no separate web server,
// no /api proxy quirks, no race between two boot processes.
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: BACKEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
