/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

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
