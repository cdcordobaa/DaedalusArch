/**
 * V1511-DEV regression (zero model calls): two `experiments/v158-dev/evaluate.ts` outputs (every v1.5 rule, no judge;
 * before = main at v1.5.10, after = this branch at v1.5.11), compared tree by tree on the sorted
 * `rule|file|subject|evidence` violation lines. Reported twice: over every rule except the new R-APPVENDOR (must be
 * byte-identical on every tree for the change to need no flag), and the R-APPVENDOR lines alone, per group.
 *
 *   npx tsx experiments/v1511-dev/regression.ts <before.json> <after.json> --out experiments/v1511-dev/results/regression.json
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

interface Row { group: string; set: string; domain: string; case: string; arm: string | null; findings: string[] }
const [bf, af] = process.argv.slice(2);
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const read = (f: string): { instrument: string; rows: Row[] } => JSON.parse(fs.readFileSync(f, 'utf8')) as { instrument: string; rows: Row[] };
const b = read(bf!); const a = read(af!);
const NEW = 'R-APPVENDOR|';
const key = (r: Row): string => `${r.group}|${r.set}|${r.domain}|${r.case}`;
const old = (r: Row): string[] => r.findings.filter((f) => !f.startsWith(NEW));
const sha = (rows: Row[]): string => createHash('sha256').update(JSON.stringify(rows.map((r) => [key(r), old(r)]))).digest('hex');
const am = new Map(a.rows.map((r) => [key(r), r]));
const differ = b.rows.filter((r) => { const x = am.get(key(r)); return x === undefined || JSON.stringify(old(x)) !== JSON.stringify(old(r)); }).map(key);
const extra = a.rows.filter((r) => !b.rows.some((x) => key(x) === key(r))).map(key);
const bucket = (r: Row): string => (r.group === 'hx' ? (r.case === 'seed' ? 'hxSeeds' : 'hxFinal') : 'dev');
const buckets: Record<string, { trees: number; findings: number; appVendorTrees: number; appVendorFindings: number }> = {};
for (const r of a.rows) {
  const k = bucket(r);
  const s = (buckets[k] ??= { trees: 0, findings: 0, appVendorTrees: 0, appVendorFindings: 0 });
  const nv = r.findings.filter((f) => f.startsWith(NEW));
  s.trees++; s.findings += old(r).length; s.appVendorFindings += nv.length; if (nv.length > 0) s.appVendorTrees++;
}
const appVendor = a.rows.flatMap((r) => r.findings.filter((f) => f.startsWith(NEW)).map((f) => `${key(r)} :: ${f}`));
const out = {
  before: b.instrument, after: a.instrument, modelCalls: 0, rows: { before: b.rows.length, after: a.rows.length },
  identicalExceptNewRule: differ.length === 0 && extra.length === 0, rowsDiffering: differ, rowsExtra: extra,
  sha256ExceptNewRule: { before: sha(b.rows), after: sha(a.rows) }, buckets, appVendor,
};
process.stdout.write(`${JSON.stringify({ ...out, rowsDiffering: differ.length, appVendor: appVendor.length })}\n`);
const f = argOf('--out');
if (f !== undefined) fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`);
