import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/liveslides/' : '/',
  plugins: [preact()],
  test: { include: ['src/**/*.test.ts'] },
});
