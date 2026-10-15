#!/usr/bin/env node
// Byte-for-byte comparison of a regenerated output against the committed one.
// Usage: node compare.mjs <label> <expected file|dir> <actual file|dir> [--root <abs path>] [--only <regex>] [--known <json>]
// --root: occurrences of this absolute path in the ACTUAL output are replaced by `<REPO>` before comparing (the only
//         normalisation, needed because some harnesses record the absolute project root).
// --only: compare only the relative paths matching the regex (files present only in `expected` and not matching are ignored).
// --known: replication/known-divergences.json; a differing file listed there is reported as KNOWN instead of DIFF.
// Prints one line per file and exits 1 on any unexpected difference.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const [label, expected, actual, ...rest] = process.argv.slice(2);
const opt = (n) => (rest.includes(n) ? rest[rest.indexOf(n) + 1] : undefined);
const root = opt('--root');
const only = opt('--only') ? new RegExp(opt('--only')) : undefined;
const knownFile = opt('--known');
const known = knownFile ? JSON.parse(readFileSync(knownFile, 'utf8')) : {};

const walk = (d) => (statSync(d).isDirectory()
  ? readdirSync(d).flatMap((e) => walk(join(d, e)))
  : [d]);
const rels = (base) => (statSync(base).isDirectory() ? walk(base).map((f) => relative(base, f)) : ['']);
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

let unexpected = 0;
const exp = new Set(rels(expected).filter((r) => !only || only.test(r)));
const act = new Set(rels(actual).filter((r) => !only || only.test(r)));
for (const r of [...new Set([...exp, ...act])].sort()) {
  const name = `${label}${r ? `/${r}` : ''}`;
  const e = join(expected, r);
  const a = join(actual, r);
  if (!existsSync(a)) { console.log(`MISSING   ${name} (committed, not regenerated)`); unexpected++; continue; }
  if (!existsSync(e)) { console.log(`EXTRA     ${name} (regenerated, not committed)`); unexpected++; continue; }
  let ab = readFileSync(a);
  if (root) ab = Buffer.from(ab.toString('utf8').split(root).join('<REPO>'), 'utf8');
  const eb = readFileSync(e);
  if (Buffer.compare(ab, eb) === 0) { console.log(`IDENTICAL ${name} sha256:${sha(eb)}`); continue; }
  const k = known[name];
  if (k) console.log(`KNOWN     ${name} (${k})`);
  else { console.log(`DIFF      ${name} committed sha256:${sha(eb)} regenerated sha256:${sha(ab)}`); unexpected++; }
}
process.exit(unexpected === 0 ? 0 : 1);
