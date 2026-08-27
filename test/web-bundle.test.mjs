// Proves the browser bundle agrees with the CLI's `sizeCircuit` — the
// thing the issue asked to guarantee, not assume. Bundles web/app.js with
// esbuild (the same entry point and settings scripts/build-web.mjs uses),
// then imports the result and checks its exported `sizeCircuit` against a
// direct import of lib/calc.js for the same five spot-check inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sizeCircuit as directSizeCircuit } from '../lib/calc.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SPOT_CHECKS = [
  { amps: 20, lengthFt: 18, dropPct: 3, voltage: 12 }, // voltage drop governs (the README example)
  { amps: 20, lengthFt: 4, dropPct: 3, voltage: 12 }, // ampacity governs at the same current, short run
  { amps: 30, lengthFt: 10, dropPct: 3, voltage: 12, engineSpace: true },
  { amps: 22, lengthFt: 5, dropPct: 10, voltage: 12 },
  { amps: 15, lengthFt: 40, dropPct: 3, voltage: 24, bundleCount: 3 },
];

test('bundled web/app.js agrees with lib/calc.js on five spot checks', async (t) => {
  const outDir = mkdtempSync(path.join(tmpdir(), 'wire-wright-web-'));
  t.after(() => rmSync(outDir, { recursive: true, force: true }));

  const outfile = path.join(outDir, 'bundle.mjs');
  await build({
    entryPoints: [path.join(root, 'web/app.js')],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    outfile,
  });

  const bundled = await import(pathToFileURL(outfile).href);

  for (const input of SPOT_CHECKS) {
    const want = directSizeCircuit(input);
    const got = bundled.sizeCircuit(input);
    assert.deepEqual(got, want, `mismatch for ${JSON.stringify(input)}`);
  }
});
