import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

process.env.VITE_APP_VERSION ||= 'baseline';
process.env.VITE_COMMIT_SHA ||= 'local-development';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    setupFiles: './src/test/setup.ts',
  },
});
