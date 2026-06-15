import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.vitest.json' })],
  resolve: {
    alias: {
      'src/': path.resolve(__dirname, 'src') + '/',
    },
  },
  optimizeDeps: {
    entries: [],
  },
  ssr: {
    noExternal: ['@material/material-color-utilities', '@cmusei/crucible-common'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.vitest.ts'],
    include: ['src/app/**/*.vitest.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/generated/**'],
      // Keep the checked-in TEST-COVERAGE-REPORT.md (and other manual files)
      // in coverage/ — without this, v8 wipes the dir before every run.
      clean: false,
    }
  },
});
