/**
 * HCAL-07 scoring copy (2026-10-29, written before any case was scored). Each case's `spec.yaml` ends with the
 * builder's glossary key, a YAML comment that holds the answer (vendor terms, core terms, rationale). The YAML parser
 * drops comments, but R-MIRROR2's stoplist (`specTokens` in `src/v15-instrument/vendor-lexicon.ts`) tokenises the raw
 * spec text, comments included, so the key's vendor terms would count as spec-owned and silence the rule. The set is
 * therefore scored from a copy in which only that block is removed.
 *
 * The transformation, per `<domain>/cases/<ID>/spec.yaml` (bases and every other file are copied unchanged):
 *   1. find the line `# Glossary key (HCAL-07 answer key for case <ID>). ...`; its case id must be the folder's;
 *   2. every line from it to the end of the file must be a comment line (`#...`) or empty, else stop;
 *   3. drop that line and every line after it, then the empty lines just before it; end the file with one newline.
 * `SCORING-COPY.sha256` holds the sha256 of the 50 resulting specs; the copy is checked against it.
 *
 *   npx tsx experiments/hcal-07/scoring-copy.ts <out-dir>            write the copy and check it
 *   npx tsx experiments/hcal-07/scoring-copy.ts <out-dir> --write    also (re)write SCORING-COPY.sha256 (prep only)
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SET = path.resolve('experiments', 'hcal-07');
const MANIFEST = path.join(SET, 'SCORING-COPY.sha256');
const HEADER = /^# Glossary key \(HCAL-07 answer key for case ([A-Za-z0-9-]+)\)\./;

export function stripKey(text: string, id: string): string {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => HEADER.test(l));
  if (i < 0) throw new Error(`${id}: no glossary key header`);
  if (HEADER.exec(lines[i]!)![1] !== id) throw new Error(`${id}: the key names another case`);
  if (lines.slice(i).some((l) => l !== '' && !l.startsWith('#'))) throw new Error(`${id}: the key is not the trailing comment block`);
  let j = i;
  while (j > 0 && lines[j - 1] === '') j--;
  const out = `${lines.slice(0, j).join('\n')}\n`;
  if (/Glossary key|vendor_terms|core_terms|rationale:/.test(out)) throw new Error(`${id}: key text left after the strip`);
  return out;
}

function main(): void {
  const out = process.argv[2];
  if (out === undefined) throw new Error('usage: scoring-copy.ts <out-dir> [--write]');
  if (fs.existsSync(out) && fs.readdirSync(out).length > 0) throw new Error(`${out} is not empty`);
  const lines: string[] = [];
  for (const domain of fs.readdirSync(SET).filter((d) => fs.existsSync(path.join(SET, d, 'labels.json'))).sort()) {
    for (const p of ['base', 'cases', 'labels.json']) fs.cpSync(path.join(SET, domain, p), path.join(out, domain, p), { recursive: true });
    for (const id of fs.readdirSync(path.join(SET, domain, 'cases')).sort()) {
      const rel = `${domain}/cases/${id}/spec.yaml`;
      const body = stripKey(fs.readFileSync(path.join(SET, rel), 'utf8'), id);
      fs.writeFileSync(path.join(out, rel), body);
      lines.push(`${createHash('sha256').update(body).digest('hex')}  ${rel}`);
    }
  }
  const manifest = `${lines.join('\n')}\n`;
  if (process.argv.includes('--write')) fs.writeFileSync(MANIFEST, manifest);
  else if (fs.readFileSync(MANIFEST, 'utf8') !== manifest) throw new Error('the copy differs from SCORING-COPY.sha256');
  const root = createHash('sha256').update(manifest).digest('hex').slice(0, 16);
  process.stdout.write(`scoring copy: ${String(lines.length)} case specs stripped, root ${root}\n`);
}
if (process.argv[1]?.endsWith('scoring-copy.ts')) main();
