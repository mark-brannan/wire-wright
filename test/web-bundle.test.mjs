// Proves the browser bundle agrees with the CLI — the thing the issue asked
// to guarantee, not assume. Bundles web/app.js with esbuild (the same entry
// point and settings scripts/build-web.mjs uses), then imports the result and
// checks what it exports against a direct import of lib/ and against the CLI
// itself, run as a subprocess on the demo's sample circuit list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sizeCircuit as directSizeCircuit } from '../lib/calc.js';
import { parseCSV, sizeRow, sizeRows } from '../lib/circuits.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const samplePath = path.join(root, 'web/sample-circuits.csv');

const SPOT_CHECKS = [
  { amps: 20, lengthFt: 18, dropPct: 3, voltage: 12 }, // voltage drop governs (the README example)
  { amps: 20, lengthFt: 4, dropPct: 3, voltage: 12 }, // ampacity governs at the same current, short run
  { amps: 30, lengthFt: 10, dropPct: 3, voltage: 12, engineSpace: true },
  { amps: 22, lengthFt: 5, dropPct: 10, voltage: 12 },
  { amps: 15, lengthFt: 40, dropPct: 3, voltage: 24, bundleCount: 3 },
];

async function bundleApp(t) {
  const outDir = mkdtempSync(path.join(tmpdir(), 'wire-wright-web-'));
  t.after(() => rmSync(outDir, { recursive: true, force: true }));

  const outfile = path.join(outDir, 'bundle.mjs');
  await build({
    entryPoints: [path.join(root, 'web/app.js')],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    loader: { '.csv': 'text' },
    outfile,
  });
  return import(pathToFileURL(outfile).href);
}

// The CLI's table, as one array of cells per circuit, in the order it prints
// them: name, amps, length_ft, drop_pct, awg, governs, fuse, wire_ampacity,
// actual_drop_pct, flags.
function cliRows(file) {
  const { status, stdout } = spawnSync('node', [path.join(root, 'bin/cli.mjs'), file], {
    encoding: 'utf8',
  });
  assert.equal(status, 0, 'the sample list sizes with no problems');
  return stdout
    .split('\n')
    .filter((line) => line.startsWith('| '))
    .slice(1) // header; the |---| rule line does not start with "| "
    .map((line) => line.slice(2, line.lastIndexOf(' |')).split(' | '));
}

test('bundled web/app.js agrees with lib/calc.js on five spot checks', async (t) => {
  const bundled = await bundleApp(t);

  for (const input of SPOT_CHECKS) {
    const want = directSizeCircuit(input);
    const got = bundled.sizeCircuit(input);
    assert.deepEqual(got, want, `mismatch for ${JSON.stringify(input)}`);
  }
});

test('the demo sample list sizes identically in the bundle, in lib/ and in the CLI', async (t) => {
  const bundled = await bundleApp(t);
  const rows = parseCSV(readFileSync(samplePath, 'utf8'));

  assert.deepEqual(bundled.sampleRows(), rows, 'the bundle carries the sample file as written');
  const want = sizeRows(rows);
  assert.deepEqual(bundled.sizeRows(bundled.sampleRows()), want);
  assert.deepEqual(want.problems, [], 'every sample circuit sizes cleanly');

  const cli = cliRows(samplePath);
  assert.equal(cli.length, rows.length);
  const cols = [
    'name',
    'amps',
    'length_ft',
    'drop_pct',
    'awg',
    'governs',
    'fuse',
    'wire_ampacity',
    'actual_drop_pct',
    'flags',
  ];
  want.out.forEach((r, i) => {
    assert.deepEqual(
      cli[i],
      cols.map((k) => String(r[k] ?? '')),
      `CLI row ${i} (${r.name})`,
    );
  });
});

test('each grid row shows the wire, fuse and flags the CLI prints for it', async (t) => {
  const bundled = await bundleApp(t);
  const cli = cliRows(samplePath);

  bundled.sampleRows().forEach((row, i) => {
    const shown = bundled.describeRow(bundled.sizeRow(row));
    const [name, , , , awg, governs, fuse, , , flags] = cli[i];
    assert.equal(shown.awg, awg, name);
    assert.equal(shown.fuse, `${fuse} A`, name);
    assert.equal(shown.flags.join(' '), flags, name);
    assert.equal(shown.rule, governs === 'voltage-drop' ? 'voltage drop' : 'heat (ampacity)', name);
    assert.equal(shown.note, '', name);
  });
});

test('the sample list shows what the demo says it shows', () => {
  const rows = parseCSV(readFileSync(samplePath, 'utf8'));
  const sized = rows.map((r) => sizeRow(r));
  const flags = sized.flatMap((s) => s.flags);

  assert.ok(
    sized.some((s) => s.row.governs === 'voltage-drop'),
    'a circuit set by voltage drop',
  );
  assert.ok(
    sized.some((s) => s.row.governs === 'ampacity'),
    'a circuit set by ampacity',
  );
  for (const f of ['length:guess', 'amps:guess', 'planned']) assert.ok(flags.includes(f), f);
  assert.ok(
    rows.some((r) => r.engine_space === 'true'),
    'a circuit through an engine space',
  );
  assert.ok(
    rows.some((r) => Number(r.bundle) > 1),
    'a bundled circuit',
  );
  assert.ok(
    rows.some((r) => r.drop_pct === '10') && rows.some((r) => r.drop_pct === '3'),
    'both drop limits',
  );
});

test('the grid shows an error for a row sizeCircuit rejects, and a warning for one it sizes with a caveat', async (t) => {
  const bundled = await bundleApp(t);

  const rejected = bundled.describeRow(
    bundled.sizeRow({
      name: 'Hot',
      amps: '5',
      length_ft: '10',
      engine_space: 'true',
      insulation_c: '60',
    }),
  );
  assert.equal(rejected.awg, '—');
  assert.equal(rejected.noteKind, 'error');
  assert.match(rejected.note, /not permitted in engine spaces/);

  const huge = bundled.describeRow(bundled.sizeRow({ name: 'Huge', amps: '400', length_ft: '60' }));
  assert.equal(huge.awg, '4/0+');
  assert.equal(huge.fuse, '—');
  assert.equal(huge.noteKind, 'warning');
});
