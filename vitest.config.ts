/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// `@datorama/akita` and `@material/material-color-utilities` ship bundler-only
// ESM: no `"type": "module"` and extensionless relative imports. Node cannot
// load either in the jsdom environment `@angular/build:unit-test` runs in, and
// the builder hardcodes `externalPackages: true`, so those packages are handed
// to Node untouched. `server.deps.inline`, `ssr.noExternal`, and
// `optimizeDeps.include` were all verified not to help on this path — the files
// on disk have to be patched. See `patches/`.
//
// Applied here, at config load, rather than from a `postinstall` hook: the
// Dockerfile copies `package.json` and runs `npm ci` before copying the rest of
// the repo, so a `postinstall` that reads `patches/` breaks the image build.
execFileSync('npx', ['patch-package'], { stdio: 'inherit' });

// No test options — `angular.json` owns the test configuration. This file
// exists solely as the hook the builder loads before running the suite.
export default defineConfig({});
