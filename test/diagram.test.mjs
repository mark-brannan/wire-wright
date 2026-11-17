// The diagram stub (web/diagram.js) draws what the grid sizes. Its shape is
// not settled (issue #7), so these check content, not layout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, sizeRow } from '../lib/circuits.js';
import { diagramSVG } from '../web/diagram.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const rows = parseCSV(readFileSync(path.join(root, 'web/sample-circuits.csv'), 'utf8'));
const circuits = rows.map((row) => ({ row, sized: sizeRow(row) }));

test('one circuit group per row, each labelled with the wire and fuse the grid shows', () => {
  const svg = diagramSVG(circuits);
  const groups = svg.match(/<g class="dg-circuit[^"]*">.*?<\/g>/g);
  assert.equal(groups.length, rows.length);
  groups.forEach((g, i) => {
    const r = circuits[i].sized.row;
    assert.ok(g.includes(`>${r.awg} AWG<`), `${r.name}: wire`);
    assert.ok(g.includes(`>${r.fuse} A<`), `${r.name}: fuse`);
  });
});

test('planned circuits and unmeasured runs are marked', () => {
  const svg = diagramSVG(circuits);
  const planned = rows.filter((r) => r.status === 'planned').length;
  assert.equal((svg.match(/dg-planned/g) ?? []).length, planned);
  const unmeasured = rows.filter((r) => r.length_source !== 'measured').length;
  assert.equal((svg.match(/dg-wire dg-guess/g) ?? []).length, unmeasured);
});

test('a circuit name cannot inject markup, and a rejected row is drawn as an error', () => {
  const row = { name: '<img src=x onerror=alert(1)>', amps: '5', length_ft: '10', engine_space: 'true', insulation_c: '60' };
  const svg = diagramSVG([{ row, sized: sizeRow(row) }]);
  assert.ok(!svg.includes('<img'));
  assert.match(svg, /dg-error/);
  assert.match(svg, />not sized</);
});
