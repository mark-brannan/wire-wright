import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, '../bin/cli.mjs');
const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

function run(args) {
  const { status, stdout, stderr } = spawnSync('node', [cli, ...args], { encoding: 'utf8' });
  return { status, stdout, stderr };
}

test('--version prints the package version and exits 0', () => {
  const { status, stdout } = run(['--version']);
  assert.equal(status, 0);
  assert.equal(stdout.trim(), version);
});

test('--help prints usage and exits 0', () => {
  const { status, stderr } = run(['--help']);
  assert.equal(status, 0);
  assert.match(stderr, /usage: wire-wright/);
});

test('no argument prints usage to stderr and exits 2', () => {
  const { status, stderr } = run([]);
  assert.equal(status, 2);
  assert.match(stderr, /usage: wire-wright/);
});

test('an unreadable path is a one-line message, not a stack trace', () => {
  const { status, stderr } = run(['/no/such/circuits.csv']);
  assert.equal(status, 1);
  assert.equal(stderr.trim(), "wire-wright: can't read /no/such/circuits.csv: no such file");
  assert.doesNotMatch(stderr, /at Object/);
});

test('an unknown flag is rejected rather than treated as a filename', () => {
  const { status, stderr } = run(['--version-typo']);
  assert.equal(status, 2);
  assert.match(stderr, /unknown option '--version-typo'/);
});

test('an unknown flag after the CSV path is rejected, not silently ignored', () => {
  const { status, stderr } = run(['/no/such/circuits.csv', '--unknown']);
  assert.equal(status, 2);
  assert.match(stderr, /unknown option '--unknown'/);
});
