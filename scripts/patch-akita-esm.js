#!/usr/bin/env node
// Patches @datorama/akita to work with ESM-native module loaders (Vitest 4+).
// The package ships .js files with ESM `export` syntax but lacks "type": "module"
// in its package.json, and uses extensionless relative imports.
// This script adds "type": "module" and appends .js extensions to all relative imports.

const fs = require('fs');
const path = require('path');

const akitaDir = path.resolve(__dirname, '..', 'node_modules', '@datorama', 'akita');
const pkgPath = path.join(akitaDir, 'package.json');

if (!fs.existsSync(pkgPath)) {
  console.log('[patch-akita-esm] @datorama/akita not found, skipping.');
  process.exit(0);
}

// 1. Add "type": "module" to package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.type === 'module') {
  console.log('[patch-akita-esm] Already patched, skipping.');
  process.exit(0);
}
pkg.type = 'module';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Fix extensionless relative imports in all .js files under src/
const srcDir = path.join(akitaDir, 'src');

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Match: from './something' or from '../something' (without .js extension)
  const patched = content.replace(
    /from '(\.\.?\/[^']+?)(?<!\.js)'/g,
    "from '$1.js'"
  );
  if (patched !== content) {
    fs.writeFileSync(filePath, patched);
  }
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      patchFile(fullPath);
    }
  }
}

walkDir(srcDir);
console.log('[patch-akita-esm] Patched @datorama/akita for ESM compatibility.');
