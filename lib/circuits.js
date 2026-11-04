// Circuit rows as the CSV contract describes them: one object per circuit,
// every value a string, keyed by column name (see the README's CSV table).
//
// The command-line tool and the web demo both turn a row into a sizing
// result and a set of flags here, so neither can read a column differently
// from the other. Nothing in this file touches the filesystem or the DOM.
import { sizeCircuit } from './calc.js';

// Minimal RFC 4180 reader: quoted fields, doubled quotes, LF or CRLF.
// The first non-empty line is the header; blank lines are skipped.
export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = '',
    inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((f) => f !== '')) rows.push(row);
  }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// How the CSV spells yes: true, yes, y or 1, in any case; anything else is no.
export const isTrue = (v) => ['true', 'yes', 'y', '1'].includes(String(v).toLowerCase());

// What a reader should not take on trust. A run length is flagged unless it
// was measured; a load current only when it is still a guess (a nameplate
// `spec` is believable, a length from a drawing is not); and any status
// other than `installed` is passed through, so `planned` is visible.
export function flagsFor(c) {
  const flags = [];
  if ((c.length_source || 'guess') !== 'measured')
    flags.push('length:' + (c.length_source || 'guess'));
  if ((c.amps_source || 'guess') === 'guess') flags.push('amps:guess');
  if (c.status && c.status !== 'installed') flags.push(c.status);
  return flags;
}

// A CSV row's columns, read into the arguments `sizeCircuit` takes. Every
// omitted optional column falls back to its documented default.
export function sizingArgs(c) {
  return {
    amps: parseFloat(c.amps),
    lengthFt: parseFloat(c.length_ft),
    dropPct: c.drop_pct ? parseFloat(c.drop_pct) : 3,
    voltage: c.voltage ? parseFloat(c.voltage) : 12,
    insulationC: c.insulation_c ? parseInt(c.insulation_c, 10) : 105,
    engineSpace: isTrue(c.engine_space),
    bundleCount: c.bundle ? parseInt(c.bundle, 10) : 1,
    continuous: c.continuous === '' || c.continuous === undefined ? true : isTrue(c.continuous),
  };
}

// Size one row. Never throws: a row `sizeCircuit` rejects comes back with
// `error` set and `row` null; otherwise `row` is the output record the CLI
// prints (amps and length_ft are echoed as typed) and `warnings` holds
// whatever `sizeCircuit` had to say about it.
export function sizeRow(c) {
  const flags = flagsFor(c);
  let r;
  try {
    r = sizeCircuit(sizingArgs(c));
  } catch (e) {
    return { name: c.name, flags, error: e.message, warnings: [], row: null };
  }
  return {
    name: c.name,
    flags,
    error: null,
    warnings: r.warnings,
    row: {
      name: c.name,
      amps: c.amps,
      length_ft: c.length_ft,
      drop_pct: c.drop_pct || '3',
      awg: r.awg,
      governs: r.governs,
      fuse: r.fuse,
      wire_ampacity: r.wireAmpacity,
      actual_drop_pct: r.actualDropPct,
      flags: flags.join(' '),
    },
  };
}

// Size a whole list. `out` holds one record per circuit that could be sized;
// `problems` is every rejection and warning as "<name>: <message>", in row
// order.
export function sizeRows(circuits) {
  const out = [];
  const problems = [];
  for (const c of circuits) {
    const s = sizeRow(c);
    if (s.error) {
      problems.push(`${s.name}: ${s.error}`);
      continue;
    }
    for (const w of s.warnings) problems.push(`${s.name}: ${w}`);
    out.push(s.row);
  }
  return { out, problems };
}
