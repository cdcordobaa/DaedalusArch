#!/usr/bin/env node
// Claims-ledger check (Docs/v1.3/compendium/claims-ledger.md).
//
// The ledger cites, for every quantitative claim, the file:line that states it and the number strings as that line
// writes them. This script re-reads every cited line in the working tree and confirms that each number string is
// still on it. It fails when a cited file or line is missing, or when a number is no longer on its line (the source
// was edited or the line moved). It reads no result file, runs nothing else and calls no service.
//
// The ledger is claims-ledger.md plus its parts in claims-ledger/*.md (the claims tables are split by objective so
// that each file stays small enough to render). By default all of them are checked; pass one or more files to check
// only those. Every markdown table whose header has a `source` column (a `path:line` in backticks) and a `numbers`
// column (number strings in backticks, separated by ` ; `) is checked. Other tables are ignored. Claim ids must be
// unique across the claims tables.
//
//   node scripts/v1.3/claims-ledger-check.mjs [file.md ...] [--quiet]
//
// Exit 0 when every row passes, 1 otherwise.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.cwd();
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const DIR = 'Docs/v1.3/compendium';
const given = args.filter((a) => !a.startsWith('--'));
const ledgerFiles = given.length ? given : [`${DIR}/claims-ledger.md`,
  ...readdirSync(join(REPO, DIR, 'claims-ledger')).filter((f) => f.endsWith('.md')).sort().map((f) => `${DIR}/claims-ledger/${f}`)];

/** Split a markdown table row into cells, honouring `\|` escapes. */
function cells(row) {
  const out = [];
  let cur = '';
  const s = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (s[i] === '|') { out.push(cur.trim()); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur.trim());
  return out;
}

/** The backticked strings of a cell, in order. */
const ticks = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

const fileCache = new Map();
function lineOf(path, n) {
  if (!fileCache.has(path)) {
    const abs = join(REPO, path);
    fileCache.set(path, existsSync(abs) ? readFileSync(abs, 'utf8').split('\n') : null);
  }
  const lines = fileCache.get(path);
  if (!lines) return { error: `file not found: ${path}` };
  if (n < 1 || n > lines.length) return { error: `line ${n} out of range (${path} has ${lines.length} lines)` };
  return { text: lines[n - 1] };
}

let checked = 0;
const failures = [];
const ids = new Map();

for (const ledgerPath of ledgerFiles) {
const md = readFileSync(join(REPO, ledgerPath), 'utf8').split('\n');
let header = null;
for (const [i, raw] of md.entries()) {
  if (!raw.trim().startsWith('|')) { header = null; continue; }
  const c = cells(raw);
  if (!header) { header = c.map((h) => h.toLowerCase()); continue; }
  if (c.every((x) => /^:?-+:?$/.test(x))) continue; // separator row
  const src = header.indexOf('source');
  const num = header.indexOf('numbers');
  if (src < 0 || num < 0) continue;
  const idCol = header.indexOf('id');
  const id = idCol >= 0 ? c[idCol] : `row@${i + 1}`;
  if (idCol >= 0) {
    if (ids.has(id)) failures.push(`${id} (${ledgerPath}:${i + 1}): duplicate id, first at ${ids.get(id)}`);
    else ids.set(id, `${ledgerPath}:${i + 1}`);
  }
  const loc = ticks(c[src] ?? '')[0];
  const m = loc && /^(.+):(\d+)$/.exec(loc);
  if (!m) { failures.push(`${id} (${ledgerPath}:${i + 1}): no \`path:line\` in the source cell`); continue; }
  const nums = ticks(c[num] ?? '');
  if (!nums.length) { failures.push(`${id} (${ledgerPath}:${i + 1}): no number in the numbers cell`); continue; }
  checked++;
  const { text, error } = lineOf(m[1], Number(m[2]));
  if (error) { failures.push(`${id} (${ledgerPath}:${i + 1}): ${error}`); continue; }
  for (const n of nums) {
    if (!text.includes(n)) failures.push(`${id} (${ledgerPath}:${i + 1}): "${n}" is not on ${m[1]}:${m[2]}`);
  }
}
}

if (!quiet || failures.length) for (const f of failures) console.log(`FAIL ${f}`);
console.log(`claims-ledger-check: ${checked} rows checked in ${ledgerFiles.length} file(s), ${failures.length} failure(s).`);
process.exit(failures.length || checked === 0 ? 1 : 0);
