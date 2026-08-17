import { defineConfig, devices } from '@playwright/test';

/**
 * Two required critical-path flows (see PLAN.md's non-functional
 * requirements): "draw a small pattern & export" and "convert an image &
 * save". Both mock the API layer via page.route() rather than hitting a
 * real backend - this is a deliberate, standard pattern for a frontend e2e
 * suite: it isolates "does the real browser, real canvas, real Angular app
 * behave correctly end to end" from backend/infra availability, and stays
 * deterministic and fast. See e2e/support/mock-api.ts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined // pointed at an already-running server (e.g. during local iteration)
    : {
        command: 'pnpm nx run web:serve',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
