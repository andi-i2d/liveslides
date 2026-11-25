import { defineConfig } from '@playwright/test';

// Lokal: installiertes Edge (kein Download). In CI: von Playwright installiertes Chromium.
// Echte Zugangsdaten aus .env.local werden überschrieben (leere Werte), damit Tests deterministisch laufen.
const blank = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_GOOGLE_CLIENT_ID: '', VITE_ALLOWED_DOMAIN: '', VITE_DRIVE_FOLDER_ID: '', VITE_GOOGLE_API_KEY: '' };

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5199',
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'off',
  },
  webServer: [
    {
      command: 'npm run dev -- --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: blank,
    },
    {
      // zweite Instanz mit aktivierter Google-Anmeldung (Google selbst wird im Test simuliert)
      command: 'npm run dev -- --port 5198 --strictPort',
      url: 'http://localhost:5198',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...blank, VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', VITE_ALLOWED_DOMAIN: 'i2d.test', VITE_GOOGLE_API_KEY: 'test-key' },
    },
    {
      // wie oben, aber ohne API-Schlüssel (Ausweichliste statt Google-Dateiwähler)
      command: 'npm run dev -- --port 5197 --strictPort',
      url: 'http://localhost:5197',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { ...blank, VITE_GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', VITE_ALLOWED_DOMAIN: 'i2d.test' },
    },
  ],
});
