import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/liveslides/' : '/',
  plugins: [preact()],
  // Bekannte Abhängigkeiten gleich beim Start bündeln: sonst entdeckt der Dev-Server sie erst beim ersten
  // Seitenaufruf und lädt mitten in einem (E2E-)Test neu.
  optimizeDeps: { include: ['preact', 'preact/hooks', 'preact/jsx-runtime', 'qrcode', '@supabase/supabase-js'] },
  test: { include: ['src/**/*.test.ts'] },
});
