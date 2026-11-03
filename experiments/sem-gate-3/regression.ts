/**
 * SEM-GATE-3 regression (zero model calls): two `experiments/v158-dev/evaluate.ts` outputs (every v1.5 rule, no judge;
 * before = main at v1.5.9 from a frozen copy of `src/`, after = this branch at v1.5.10) must be byte-identical row for
 * row: the same trees and, per tree, the same sorted `rule|file|subject|evidence` violation lines. Writes the summary
 * with the sha256 of each side's rows.
 *
 *   npx tsx experiments/sem-gate-3/regression.ts <before.json> <after.json> --out experiments/sem-gate-3/results/regression.json
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

interface Row { group: string; set: string; domain: string; case: string; arm: string | null; findings: string[] }
const [bf, af] = process.argv.slice(2);
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const read = (f: string): { instrument: string; rows: Row[] } => JSON.parse(fs.readFileSync(f, 'utf8')) as { instrument: string; rows: Row[] };
const b = read(bf!); const a = read(af!);
const key = (r: Row): string => `${r.group}|${r.set}|${r.domain}|${r.case}`;
const sha = (rows: Row[]): string => createHash('sha256').update(JSON.stringify(rows.map((r) => [key(r), r.findings]))).digest('hex');
const am = new Map(a.rows.map((r) => [key(r), r]));
const differ = b.rows.filter((r) => JSON.stringify(am.get(key(r))?.findings) !== JSON.stringify(r.findings)).map(key);
const missing = b.rows.filter((r) => !am.has(key(r))).map(key);
const extra = a.rows.filter((r) => !b.rows.some((x) => key(x) === key(r))).map(key);
const count = (rows: Row[], pred: (r: Row) => boolean): { trees: number; findings: number } => ({ trees: rows.filter(pred).length, findings: rows.filter(pred).reduce((s, r) => s + r.findings.length, 0) });
const buckets = {
  hxSeeds: count(a.rows, (r) => r.group === 'hx' && r.case === 'seed'),
  hxFinal: count(a.rows, (r) => r.group === 'hx' && r.case !== 'seed'),
  dev: count(a.rows, (r) => r.group === 'dev'),
};
const mirrorSem = a.rows.reduce((s, r) => s + r.findings.filter((f) => f.startsWith('R-MIRROR-SEM|')).length, 0);
const out = {
  before: b.instrument, after: a.instrument, modelCalls: 0, rows: { before: b.rows.length, after: a.rows.length }, buckets,
  identical: differ.length === 0 && missing.length === 0 && extra.length === 0, rowsDiffering: differ, rowsMissing: missing, rowsExtra: extra,
  sha256: { before: sha(b.rows), after: sha(a.rows) }, rMirrorSemFindingsAfter: mirrorSem,
};
process.stdout.write(`${JSON.stringify({ ...out, rowsDiffering: differ.length })}\n`);
const f = argOf('--out');
if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
