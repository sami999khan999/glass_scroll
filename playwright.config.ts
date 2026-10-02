import { defineConfig, devices } from '@playwright/test'

const PORT = '4310'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // One browser process at a time: running Chromium, Firefox and WebKit concurrently crashes the
  // WebKit process on Windows. Each project still runs its own tests in parallel.
  workers: process.env.CI ? 2 : 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Runs the built package through a real Next.js production build, so SSR output and the
    // "use client" boundary are exercised exactly as a consumer would get them.
    command: 'pnpm --filter next-app build && pnpm --filter next-app start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // The Next production build runs first, so allow for a cold compile.
    timeout: 600_000,
  },
})
