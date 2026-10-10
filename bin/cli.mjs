#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseCSV, sizeRows } from '../lib/circuits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

const USAGE = `usage: wire-wright <circuits.csv>
       wire-wright --version | -v
       wire-wright --help | -h

required columns: name, amps, length_ft (round trip)
optional: drop_pct (3|10, default 3), voltage (default 12), engine_space,
          bundle, insulation_c (default 105), continuous (default true),
          amps_source, length_source (guess|spec|measured), status, notes`;

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

  const badOpt = process.argv.slice(2).find((a) => a.startsWith('-'));
  if (badOpt) {
    console.error(`wire-wright: unknown option '${badOpt}'\n`);
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

  const { out, problems } = sizeRows(parseCSV(text));

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
