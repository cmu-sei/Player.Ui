import { defineConfig, mergeConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import browserBaseConfig from './vitest.browser.base.js';

export default mergeConfig(
  browserBaseConfig,
  defineConfig({
    test: {
      browser: {
        provider: playwright({
          launchOptions: { args: ['--no-sandbox'] },
        }),
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
    },
  })
);
