// The DC circuit sizer, run in the browser. Same math as the CLI: this file
// imports lib/calc.js and lib/circuits.js directly and esbuild bundles them
// (with lib/tables.js and ampacity/data/e11.json) into one file for the page.
// No table value, formula or flag rule is copied here — the circuit grid hands
// each row to the same `sizeRow` the CLI prints from, and
// test/web-bundle.test.mjs bundles this same file and checks it against the
// CLI.
import { sizeCircuit } from '../lib/calc.js';
import { AMPACITY_OUTSIDE } from '../lib/tables.js';
import { parseCSV, sizeRow, sizeRows, isTrue } from '../lib/circuits.js';
import SAMPLE_CSV from './sample-circuits.csv';

export { sizeCircuit, parseCSV, sizeRow, sizeRows };

// The sample circuit list, as CSV-shaped rows (see web/sample-circuits.csv).
export const sampleRows = () => parseCSV(SAMPLE_CSV);

const AWG_LABEL = (awg) => (awg === null ? '4/0+' : `${awg} AWG`);
const RULE_LABEL = { 'voltage-drop': 'voltage drop', ampacity: 'heat (ampacity)' };

function sentence(r, lengthFt) {
  if (r.awg === null) return r.warnings[0];
  if (r.fuse === null) {
    return `At ${lengthFt} ft round trip, ${AWG_LABEL(r.awg)} is required, but no standard fuse fits.`;
  }
  return `At ${lengthFt} ft round trip, ${RULE_LABEL[r.governs]} decides: ${AWG_LABEL(r.awg)}, ${r.fuse}A fuse.`;
}

// Pure enough to unit-test without touching the DOM: given the raw form
// values, return what the page should show.
export function resultFor({ amps, lengthFt, voltage = 12, critical, engineSpace, bundle }) {
  if (!(amps > 0) || !(lengthFt > 0) || !(voltage > 0)) return null;
  const r = sizeCircuit({
    amps,
    lengthFt,
    voltage,
    dropPct: critical ? 3 : 10,
    engineSpace,
    bundleCount: bundle,
  });
  return { ...r, sentence: sentence(r, lengthFt) };
}

// What one grid row shows for its sizing result, as plain strings. `s` is
// what `sizeRow` returned. A row `sizeCircuit` rejects shows an error; one
// it sized with a caveat shows the warning under the row.
export function describeRow(s) {
  const shown = { awg: '—', fuse: '—', rule: '', flags: s.flags, note: '', noteKind: '' };
  if (s.error) return { ...shown, note: s.error, noteKind: 'error' };
  const { awg, fuse, governs } = s.row;
  return {
    ...shown,
    awg: awg === null ? '4/0+' : awg,
    fuse: fuse === null ? '—' : `${fuse} A`,
    rule: RULE_LABEL[governs] ?? '',
    note: s.warnings.join(' '),
    noteKind: s.warnings.length ? 'warning' : '',
  };
}

const FLAG_HELP = {
  'length:guess': 'The run length is a guess. Measure the wire run before you buy wire.',
  'length:spec': 'The run length comes from a drawing or spec, not from measuring the boat.',
  'amps:guess': 'The load current is a guess. Use the nameplate, or measure it.',
  planned: 'Not installed yet.',
};

// The grid's input columns, in order. `key` is the CSV column the cell edits,
// so a row is always a valid CSV row for lib/circuits.js.
const SOURCES = [['guess', 'guess'], ['spec', 'spec'], ['measured', 'measured']];
const INSULATION = Object.keys(AMPACITY_OUTSIDE)
  .sort((a, b) => a - b)
  .map((c) => [c, `${c}°C`]);
const INPUTS = [
  { key: 'name', label: 'Circuit', kind: 'text', cls: 'name' },
  { key: 'amps', label: 'Amps', kind: 'number', min: 0, step: 0.1 },
  { key: 'length_ft', label: 'Length (RT ft)', kind: 'number', min: 0, step: 0.5 },
  { key: 'drop_pct', label: 'Max drop', kind: 'select', options: [['3', '3%'], ['10', '10%']] },
  { key: 'engine_space', label: 'Engine space', kind: 'check' },
  { key: 'bundle', label: 'Bundled', kind: 'number', min: 1, step: 1 },
  { key: 'insulation_c', label: 'Insulation', kind: 'select', options: INSULATION },
  { key: 'amps_source', label: 'Amps source', kind: 'select', options: SOURCES },
  { key: 'length_source', label: 'Length source', kind: 'select', options: SOURCES },
  { key: 'status', label: 'Status', kind: 'select', options: [['installed', 'installed'], ['planned', 'planned']] },
];
// Four result columns and the remove button follow the inputs (web/index.html).
const COLUMNS = INPUTS.length + 4 + 1;

const NEW_ROW = {
  name: 'New circuit', amps: '5', length_ft: '20', drop_pct: '3', engine_space: 'false', bundle: '1',
  insulation_c: '105', amps_source: 'guess', length_source: 'guess', status: 'planned',
};

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function control(col, row, onChange) {
  const common = { 'aria-label': col.label };
  let node;
  if (col.kind === 'select') {
    node = h('select', common, ...col.options.map(([value, text]) => h('option', { value, textContent: text })));
    node.value = row[col.key];
  } else if (col.kind === 'check') {
    node = h('input', { ...common, type: 'checkbox', checked: isTrue(row[col.key]) });
  } else {
    node = h('input', { ...common, type: col.kind, value: row[col.key] });
    if (col.kind === 'number') {
      node.min = col.min;
      node.step = col.step;
      node.inputMode = 'decimal';
    }
  }
  node.addEventListener('input', () => onChange(col.kind === 'check' ? String(node.checked) : node.value));
  return node;
}

function initGrid() {
  const body = document.getElementById('gridBody');
  const addButton = document.getElementById('addCircuit');

  function addRow(row) {
    const out = {
      awg: h('td', { class: 'out num' }),
      fuse: h('td', { class: 'out num' }),
      rule: h('td', { class: 'out' }),
      flags: h('td', { class: 'out flags' }),
    };
    // On a screen too narrow for the whole grid, the result sits under the
    // name, which stays pinned while the inputs scroll (see web/index.html).
    const brief = h('div', { class: 'brief' });
    const noteCell = h('td', { colSpan: COLUMNS });
    const noteRow = h('tr', { class: 'note', hidden: true }, noteCell);

    function refresh() {
      const d = describeRow(sizeRow(row));
      out.awg.textContent = d.awg;
      out.fuse.textContent = d.fuse;
      out.rule.textContent = d.rule;
      out.flags.replaceChildren(h('div', { class: 'flagbox' }, ...d.flags.map((f) => {
        const kind = f.endsWith(':guess') ? 'guess' : f.includes(':') ? 'spec' : 'status';
        return h('span', { class: `flag flag-${kind}`, textContent: f, title: FLAG_HELP[f] ?? '' });
      })));
      brief.textContent = d.fuse === '—' ? '' : `${d.awg} AWG, ${d.fuse} fuse`;
      noteCell.textContent = d.note;
      noteCell.className = d.noteKind;
      noteRow.hidden = d.note === '';
    }

    const remove = h('button', { type: 'button', class: 'remove', textContent: '×', title: 'Remove this circuit' });
    remove.setAttribute('aria-label', 'Remove this circuit');
    remove.addEventListener('click', () => { tr.remove(); noteRow.remove(); });

    const tr = h('tr', {},
      ...INPUTS.map((col) => {
        const cell = h('td', { class: col.cls ?? '' }, control(col, row, (v) => { row[col.key] = v; refresh(); }));
        if (col.key === 'name') cell.append(brief);
        return cell;
      }),
      out.awg, out.fuse, out.rule, out.flags,
      h('td', {}, remove));
    body.append(tr, noteRow);
    refresh();
    return tr;
  }

  for (const row of sampleRows()) addRow(row);
  addButton.addEventListener('click', () => {
    const name = addRow({ ...NEW_ROW }).querySelector('input');
    name.focus();
    name.select();
  });
}

function initCalculator() {
  const $ = (id) => document.getElementById(id);
  const inputs = {
    amps: $('amps'),
    lengthFt: $('lengthFt'),
    voltage: $('voltage'),
    critical: $('critical'),
    engineSpace: $('engineSpace'),
    bundle: $('bundle'),
  };
  const out = { awg: $('outAwg'), fuse: $('outFuse'), sentence: $('outSentence'), warning: $('outWarning') };

  function update() {
    const r = resultFor({
      amps: parseFloat(inputs.amps.value),
      lengthFt: parseFloat(inputs.lengthFt.value),
      voltage: parseFloat(inputs.voltage.value),
      critical: inputs.critical.checked,
      engineSpace: inputs.engineSpace.checked,
      bundle: parseInt(inputs.bundle.value, 10) || 1,
    });
    if (!r) {
      out.awg.textContent = '—';
      out.fuse.textContent = '—';
      out.sentence.textContent = '';
      out.warning.textContent = '';
      return;
    }
    out.warning.textContent = r.warnings.join(' ');
    if (r.awg === null) {
      out.awg.textContent = '—';
      out.fuse.textContent = '—';
      out.sentence.textContent = r.sentence;
      return;
    }
    out.awg.textContent = AWG_LABEL(r.awg);
    out.fuse.textContent = r.fuse === null ? '—' : `${r.fuse} A`;
    out.sentence.textContent = r.sentence;
  }

  for (const el of Object.values(inputs)) el.addEventListener('input', update);
  update();
}

function initDOM() {
  initGrid();
  initCalculator();
}

// Guarded so this same file can be bundled and required in a test without a
// DOM present (see test/web-bundle.test.mjs).
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDOM);
  else initDOM();
}
