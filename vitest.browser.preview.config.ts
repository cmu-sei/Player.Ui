import { defineConfig, mergeConfig } from 'vitest/config';
import { preview } from '@vitest/browser-preview';
import browserBaseConfig from './vitest.browser.base.js';

export default mergeConfig(
  browserBaseConfig,
  defineConfig({
    test: {
      browser: {
        provider: preview(),
        instances: [
          { browser: 'preview', name: 'desktop-hd', viewport: { width: 1920, height: 1080 } },
          { browser: 'preview', name: 'laptop', viewport: { width: 1280, height: 800 } },
          { browser: 'preview', name: 'macbook', viewport: { width: 1440, height: 900 } },
          { browser: 'preview', name: 'mobile', viewport: { width: 375, height: 667 } },
        ],
      },
    },
  })
);
