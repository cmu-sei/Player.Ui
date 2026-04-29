import { defineConfig, mergeConfig } from 'vitest/config';
import { preview } from '@vitest/browser-preview';
import browserBaseConfig from './vitest.browser.base.js';

export default mergeConfig(
  browserBaseConfig,
  defineConfig({
    test: {
      browser: {
        provider: preview(),
        // Single viewport only — the preview provider opens one browser
        // panel per instance, so multiple instances = multiple windows.
        // For multi-viewport coverage, use the playwright (headless) config
        // at vitest.browser.config.ts.
        instances: [
          { browser: 'preview', name: 'desktop-hd', viewport: { width: 1920, height: 1080 } },
        ],
      },
    },
  })
);
