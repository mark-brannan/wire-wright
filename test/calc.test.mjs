// Driven by the shared fixture set in the `ampacity` data package —
// the same cases any other-language implementation must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sizeCircuit, awgForVoltageDrop, ampacity } from '../lib/calc.js';

const require = createRequire(import.meta.url);
const fixtures = require('ampacity/fixtures/abyc-fixtures.json');

test('voltage drop matches ABYC lookup-table fixtures', () => {
  for (const c of fixtures.voltage_drop) {
    const got = awgForVoltageDrop({ amps: c.amps, lengthFt: c.length_ft, dropPct: c.drop_pct, voltage: c.voltage }).awg;
    assert.equal(got, c.awg, `${c.amps}A @ ${c.length_ft}ft @ ${c.drop_pct}%`);
  }
});

test('ampacity matches E-11 Table 6A fixtures', () => {
  for (const c of fixtures.ampacity) {
    const got = ampacity(c.awg, { insulationC: c.insulation_c, engineSpace: c.engine_space, bundleCount: c.bundle });
    assert.equal(Math.round(got * 10) / 10, c.amps, `${c.awg} AWG ${c.insulation_c}C engine=${c.engine_space} bundle=${c.bundle}`);
  }
});

test('not-permitted combinations throw', () => {
  for (const c of fixtures.not_permitted) {
    assert.throws(() => ampacity('12', { insulationC: c.insulation_c, engineSpace: c.engine_space }));
  }
});

test('combined sizing: ampacity can govern over voltage drop', () => {
  const r = sizeCircuit({ amps: 30, lengthFt: 10, dropPct: 3, engineSpace: true });
  assert.equal(r.awg, '10');
  assert.equal(r.fuse, 40);
});

test('fuse window forces wire upsize when needed', () => {
  const r = sizeCircuit({ amps: 22, lengthFt: 5, dropPct: 10 });
  assert.equal(r.awg, '14');
  assert.equal(r.fuse, 30);
});
