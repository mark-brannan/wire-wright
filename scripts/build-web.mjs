#!/usr/bin/env node
// Bundles web/app.js — which imports lib/calc.js and lib/circuits.js
// directly, and inlines web/sample-circuits.csv — into one self-contained
// script for GitHub Pages, so the page can never drift from the package:
// there is nothing to keep in sync by hand. Run in CI
// (.github/workflows/pages.yml) on every push to main, and locally to
// preview (see docs/development in the issue notes / README).
import { build } from 'esbuild';
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'dist-web');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'web/app.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  loader: { '.csv': 'text' },
  outfile: path.join(outDir, 'bundle.js'),
});

copyFileSync(path.join(root, 'web/index.html'), path.join(outDir, 'index.html'));

console.log(`built ${outDir}`);
