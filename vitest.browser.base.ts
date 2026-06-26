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
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: [
          'import',
          'global-builtin',
          'color-functions',
          'if-function',
        ],
      },
    },
  },
  optimizeDeps: {
    include: [
      '@angular/core',
      '@angular/core/testing',
      '@angular/common',
      '@angular/common/http',
      '@angular/forms',
      '@angular/router',
      '@angular/router/testing',
      '@angular/platform-browser',
      '@angular/platform-browser/animations',
      '@angular/platform-browser-dynamic/testing',
      '@angular/cdk/clipboard',
      '@angular/cdk/collections',
      '@angular/cdk/drag-drop',
      '@angular/cdk/scrolling',
      '@angular/cdk/table',
      '@angular/material/autocomplete',
      '@angular/material/badge',
      '@angular/material/bottom-sheet',
      '@angular/material/button',
      '@angular/material/button-toggle',
      '@angular/material/card',
      '@angular/material/checkbox',
      '@angular/material/chips',
      '@angular/material/core',
      '@angular/material/datepicker',
      '@angular/material/dialog',
      '@angular/material/divider',
      '@angular/material/expansion',
      '@angular/material/form-field',
      '@angular/material/grid-list',
      '@angular/material/icon',
      '@angular/material/icon/testing',
      '@angular/material/input',
      '@angular/material/list',
      '@angular/material/menu',
      '@angular/material/paginator',
      '@angular/material/progress-bar',
      '@angular/material/progress-spinner',
      '@angular/material/radio',
      '@angular/material/select',
      '@angular/material/sidenav',
      '@angular/material/slide-toggle',
      '@angular/material/slider',
      '@angular/material/snack-bar',
      '@angular/material/sort',
      '@angular/material/stepper',
      '@angular/material/table',
      '@angular/material/tabs',
      '@angular/material/toolbar',
      '@angular/material/tooltip',
      '@angular/material/tree',
      '@analogjs/vitest-angular/setup-zone',
      '@cmusei/crucible-common',
      // @datorama/akita ships ESM without "type": "module" and with
      // extensionless relative imports. Pre-bundling here normalizes it to
      // valid ESM, so the browser/jsdom loaders never see those quirks. These
      // two entries MUST stay in the include list — dropping them brings the
      // ESM-loading errors back. (This is why no node_modules patch is needed.)
      '@datorama/akita',
      '@datorama/akita-ng-router-store',
      '@testing-library/angular',
      '@testing-library/jest-dom/vitest',
      '@testing-library/user-event',
      'angular-resizable-element',
      'ngx-clipboard',
      'rxjs',
      'rxjs/operators',
      'tslib',
    ],
    // @microsoft/signalr is intentionally NOT pre-bundled: notification.service
    // tests use vi.mock('@microsoft/signalr'), and Vitest cannot intercept a
    // module that has been optimized into an esbuild chunk. Excluding it keeps
    // the mock working in browser mode (it already worked in jsdom).
    exclude: ['@microsoft/signalr'],
  },
  server: {
    host: '0.0.0.0',
    port: 51310,
  },
  test: {
    globals: true,
    include: ['src/app/**/*.spec.ts'],
    setupFiles: ['src/test-setup.vitest.browser.ts'],
    reporters: ['default'],
    isolate: true,
    api: {
      host: '0.0.0.0',
      port: 51311,
      // Binding to a non-loopback host (0.0.0.0) makes Vitest default
      // allowExec/allowWrite to false, which disables re-running tests and
      // updating snapshots from the UI ("Cannot run tests when api.allowExec
      // is false"). We bind 0.0.0.0 on purpose so the dashboard is reachable
      // from the host, so opt back in explicitly. Safe here: this is a local
      // dev container, not a shared/public host.
      allowExec: true,
      allowWrite: true,
    },
    browser: {
      enabled: true,
      api: {
        host: '0.0.0.0',
        port: 63320,
        // Browser mode reads allowExec from browser.api (not test.api), so it
        // must be set here too. Same rationale as above.
        allowExec: true,
        allowWrite: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Keep this list in sync with vitest.config.ts (jsdom). app.service.ts is
      // an empty, unused injectable shell with nothing to assert; the generated
      // API client is excluded because we don't test generated code.
      exclude: ['**/generated/**', '**/app.service.ts'],
      clean: false,
    },
  },
});
