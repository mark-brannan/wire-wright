#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sizeCircuit } from '../lib/calc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const USAGE = `usage: wire-wright <circuits.csv>

required columns: name, amps, length_ft (round trip)
optional: drop_pct (3|10, default 3), voltage (default 12), engine_space,
          bundle, insulation_c (default 105), continuous (default true),
          amps_source, length_source (guess|spec|measured), status, notes`;

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f !== '')) rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const bool = (v) => ['true', 'yes', 'y', '1'].includes(String(v).toLowerCase());

function main() {
  const arg = process.argv[2];

  if (arg === '--version' || arg === '-v') {
    console.log(version);
    return;
  }

  if (!arg || arg === '--help' || arg === '-h') {
    console.error(USAGE);
    process.exitCode = arg ? 0 : 2;
    return;
  }

  if (arg.startsWith('-')) {
    console.error(`wire-wright: unknown option '${arg}'\n`);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }

  const file = arg;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`wire-wright: can't read ${file}: ${e.code === 'ENOENT' ? 'no such file' : e.message}`);
    process.exitCode = 1;
    return;
  }

  const circuits = parseCSV(text);
  const out = [];
  const problems = [];

  for (const c of circuits) {
    const flags = [];
    if ((c.length_source || 'guess') !== 'measured') flags.push('length:' + (c.length_source || 'guess'));
    if ((c.amps_source || 'guess') === 'guess') flags.push('amps:guess');
    if (c.status && c.status !== 'installed') flags.push(c.status);

    let r;
    try {
      r = sizeCircuit({
        amps: parseFloat(c.amps),
        lengthFt: parseFloat(c.length_ft),
        dropPct: c.drop_pct ? parseFloat(c.drop_pct) : 3,
        voltage: c.voltage ? parseFloat(c.voltage) : 12,
        insulationC: c.insulation_c ? parseInt(c.insulation_c, 10) : 105,
        engineSpace: bool(c.engine_space),
        bundleCount: c.bundle ? parseInt(c.bundle, 10) : 1,
        continuous: c.continuous === '' || c.continuous === undefined ? true : bool(c.continuous),
      });
    } catch (e) {
      problems.push(`${c.name}: ${e.message}`);
      continue;
    }
    for (const w of r.warnings) problems.push(`${c.name}: ${w}`);
    out.push({ name: c.name, amps: c.amps, length_ft: c.length_ft, drop_pct: c.drop_pct || '3', awg: r.awg, governs: r.governs, fuse: r.fuse, wire_ampacity: r.wireAmpacity, actual_drop_pct: r.actualDropPct, flags: flags.join(' ') });
  }

  const cols = ['name', 'amps', 'length_ft', 'drop_pct', 'awg', 'governs', 'fuse', 'wire_ampacity', 'actual_drop_pct', 'flags'];
  const head = ['Circuit', 'Amps', 'Len (RT ft)', 'Max drop %', 'AWG', 'Governed by', 'Fuse (A)', 'Wire ampacity', 'Actual drop %', 'Flags'];
  console.log('| ' + head.join(' | ') + ' |');
  console.log('|' + head.map(() => '---').join('|') + '|');
  for (const r of out) console.log('| ' + cols.map((k) => r[k] ?? '').join(' | ') + ' |');

  if (problems.length) {
    console.log('\n**Problems:**\n');
    for (const p of problems) console.log('- ' + p);
    process.exitCode = 1;
  }
}

main();
