/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

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
    include: ['src/app/**/*.spec.ts'],
    reporters: ['default'],
    // The `test:dashboard` script binds the API to 0.0.0.0 so the Vitest UI is
    // reachable from the host. Binding to a non-loopback host makes Vitest
    // default allowExec/allowWrite to false, which disables re-running tests
    // and updating snapshots from the dashboard. Opt back in explicitly — safe
    // in this local dev container.
    api: {
      allowExec: true,
      allowWrite: true,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // app.service.ts is an empty, unused injectable shell (just an unread
      // HttpClient in its constructor) — nothing to assert, so it's excluded
      // rather than dragging the coverage denominator down.
      exclude: ['**/generated/**', '**/app.service.ts'],
      // Keep the checked-in TEST-COVERAGE-REPORT.md (and other manual files)
      // in coverage/ — without this, v8 wipes the dir before every run.
      clean: false,
    }
  },
});
