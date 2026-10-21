// The row layer the CLI and the web demo share. Sizing itself is covered by
// calc.test.mjs against the published ABYC cases; these tests check that a
// CSV-shaped row reaches `sizeCircuit` with the right arguments and comes
// back with the right flags.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizeCircuit } from '../lib/calc.js';
import { parseCSV, flagsFor, sizingArgs, sizeRow, sizeRows } from '../lib/circuits.js';

test('a row carrying only the required columns is sized with the documented defaults', () => {
  const row = { name: 'Pump', amps: '20', length_ft: '18' };
  assert.deepEqual(sizingArgs(row), {
    amps: 20,
    lengthFt: 18,
    dropPct: 3,
    voltage: 12,
    insulationC: 105,
    engineSpace: false,
    bundleCount: 1,
    continuous: true,
  });
  const s = sizeRow(row);
  // 10.75 x 20 A x 18 ft / (3% of 12 V) = 10,750 circular mils: past 10 AWG
  // (10,380), so 8 AWG, and the 25 A fuse (125% of 20 A) fits under its ampacity.
  assert.equal(s.row.awg, '8');
  assert.equal(s.row.governs, 'voltage-drop');
  assert.equal(s.row.fuse, 25);
});

test('every optional column reaches sizeCircuit', () => {
  const row = {
    name: 'Windlass',
    amps: '15',
    length_ft: '40',
    drop_pct: '3',
    voltage: '24',
    engine_space: 'no',
    bundle: '3',
    insulation_c: '105',
    continuous: 'false',
  };
  const want = sizeCircuit({
    amps: 15,
    lengthFt: 40,
    dropPct: 3,
    voltage: 24,
    bundleCount: 3,
    continuous: false,
  });
  assert.equal(sizeRow(row).row.awg, want.awg);
  assert.equal(sizeRow(row).row.fuse, want.fuse);
  assert.equal(sizeRow(row).row.wire_ampacity, want.wireAmpacity);
  assert.equal(sizeRow(row).row.actual_drop_pct, want.actualDropPct);
});

test('engine_space accepts true, yes, y and 1, and nothing else', () => {
  for (const v of ['true', 'TRUE', 'yes', 'y', '1']) {
    assert.equal(sizingArgs({ amps: '1', length_ft: '1', engine_space: v }).engineSpace, true, v);
  }
  for (const v of ['false', 'no', '0', '', undefined]) {
    assert.equal(
      sizingArgs({ amps: '1', length_ft: '1', engine_space: v }).engineSpace,
      false,
      String(v),
    );
  }
});

test('published case: 30 A, 10 ft, engine space is 10 AWG on a 40 A fuse', () => {
  const s = sizeRow({
    name: 'Blower',
    amps: '30',
    length_ft: '10',
    drop_pct: '3',
    engine_space: 'true',
  });
  assert.equal(s.row.awg, '10');
  assert.equal(s.row.fuse, 40);
});

test('a bundled short run is set by ampacity, not voltage drop', () => {
  // 15 A, 8 ft at 10% needs only 18 AWG for voltage drop, but two bundled
  // conductors carry 0.7 of table ampacity: 16 AWG is the heat minimum, and a
  // 20 A fuse (125% of 15 A, rounded up) then forces 14 AWG (24.5 A).
  const s = sizeRow({
    name: 'Watermaker',
    amps: '15',
    length_ft: '8',
    drop_pct: '10',
    bundle: '2',
  });
  assert.equal(s.row.governs, 'ampacity');
  assert.equal(s.row.awg, '14');
  assert.equal(s.row.fuse, 20);
  assert.equal(s.row.wire_ampacity, 24.5);
});

test('published case: 22 A, 5 ft at 10% is upsized to 14 AWG to open a 30 A fuse window', () => {
  const s = sizeRow({ name: 'Pump', amps: '22', length_ft: '5', drop_pct: '10' });
  assert.equal(s.row.awg, '14');
  assert.equal(s.row.fuse, 30);
});

test('flags: nothing measured and nothing declared flags both inputs', () => {
  assert.deepEqual(flagsFor({}), ['length:guess', 'amps:guess']);
});

test('flags: a measured length with a nameplate current is clean', () => {
  assert.deepEqual(flagsFor({ length_source: 'measured', amps_source: 'spec' }), []);
  assert.deepEqual(
    flagsFor({ length_source: 'measured', amps_source: 'measured', status: 'installed' }),
    [],
  );
});

test('flags: a spec length is flagged, a spec current is not, and a status other than installed passes through', () => {
  assert.deepEqual(flagsFor({ length_source: 'spec', amps_source: 'spec', status: 'planned' }), [
    'length:spec',
    'planned',
  ]);
  assert.deepEqual(flagsFor({ length_source: 'measured', amps_source: 'guess' }), ['amps:guess']);
});

test('a rejected row comes back with its error and no output record', () => {
  const s = sizeRow({ name: 'Bad', amps: 'x', length_ft: '3' });
  assert.equal(s.row, null);
  assert.equal(s.error, 'amps and lengthFt must be positive');
});

test('a combination E-11 does not permit is an error on that row, not a throw', () => {
  const s = sizeRow({
    name: 'Hot',
    amps: '5',
    length_ft: '10',
    engine_space: 'true',
    insulation_c: '60',
  });
  assert.equal(s.row, null);
  assert.match(s.error, /60°C insulation is not permitted in engine spaces/);
});

test('sizeRows keeps sized rows in order and reports rejections and warnings by name', () => {
  const { out, problems } = sizeRows([
    { name: 'Light', amps: '2', length_ft: '10' },
    { name: 'Bad', amps: '', length_ft: '10' },
    { name: 'Big', amps: '400', length_ft: '60' },
  ]);
  assert.deepEqual(
    out.map((r) => r.name),
    ['Light', 'Big'],
  );
  assert.equal(out[1].awg, null);
  assert.deepEqual(problems, [
    'Bad: amps and lengthFt must be positive',
    'Big: load exceeds 4/0 AWG — parallel runs or higher voltage needed',
  ]);
});

test('an output record echoes amps and length as typed and joins flags with spaces', () => {
  const { row } = sizeRow({
    name: 'Radio',
    amps: '6.0',
    length_ft: '28',
    length_source: 'guess',
    amps_source: 'spec',
  });
  assert.equal(row.amps, '6.0');
  assert.equal(row.length_ft, '28');
  assert.equal(row.drop_pct, '3');
  assert.equal(row.flags, 'length:guess');
});

test('parseCSV reads quoted commas, doubled quotes, CRLF and blank lines', () => {
  const rows = parseCSV('name , amps\r\n"Pump, bilge",5\r\n\r\n"a ""b"" c",6\r\n');
  assert.deepEqual(rows, [
    { name: 'Pump, bilge', amps: '5' },
    { name: 'a "b" c', amps: '6' },
  ]);
});
