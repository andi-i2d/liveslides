import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/liveslides/' : '/',
  plugins: [preact()],
});
