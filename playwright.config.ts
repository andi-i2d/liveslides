import { defineConfig } from '@playwright/test';

// Lokal: installiertes Edge (kein Download). In CI: von Playwright installiertes Chromium.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5199',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
