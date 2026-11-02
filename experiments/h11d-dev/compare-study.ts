/**
 * H11D-DEV gate (zero calls): compares two `evaluate-study.ts` outputs (before, after). The gate: every R-MIRROR2
 * finding whose evidence starts `[literal]` or `[error]` (the shapes the registered Hexagonal study counted,
 * `HX_MIRROR2_SHAPES.i`) is byte-identical, per session and per tree (seed, final). Also prints the per-arm counts of
 * every shape before and after (findings, and identities rule|file|subject on the final step new against the seed).
 * Exit code 1 when the counted-shape diff is not empty.
 * Run: npx tsx experiments/h11d-dev/compare-study.ts <before.json> <after.json>
 */
import fs from 'node:fs';
import { HX_MIRROR2_SHAPES } from '../v15-study/score-study.js';

interface Out { sessions: { session: string; arm: string; seed: string[]; final: string[] }[] }
const [bPath, aPath] = process.argv.slice(2);
if (bPath === undefined || aPath === undefined) { process.stderr.write('usage: compare-study.ts <before> <after>\n'); process.exit(2); }
const before = JSON.parse(fs.readFileSync(bPath, 'utf8')) as Out;
const after = JSON.parse(fs.readFileSync(aPath, 'utf8')) as Out;
const counted = HX_MIRROR2_SHAPES.i as readonly string[];
const shapeOf = (f: string): string => /\|\[([a-z-]+)\]/.exec(f)?.[1] ?? '?';
const identity = (f: string): string => f.split('|').slice(0, 2).join('|');
const diff: string[] = [];
const byId = new Map(after.sessions.map((s) => [s.session, s]));
if (before.sessions.length !== after.sessions.length) diff.push(`session count ${String(before.sessions.length)} vs ${String(after.sessions.length)}`);
for (const b of before.sessions) {
  const a = byId.get(b.session);
  if (a === undefined) { diff.push(`${b.session}: missing after`); continue; }
  for (const k of ['seed', 'final'] as const) {
    const pick = (xs: string[]): string[] => xs.filter((f) => counted.includes(shapeOf(f))).sort();
    const x = pick(b[k]); const y = pick(a[k]);
    for (const f of x) if (!y.includes(f)) diff.push(`${b.session} ${k} - ${f}`);
    for (const f of y) if (!x.includes(f)) diff.push(`${b.session} ${k} + ${f}`);
    if (x.length !== y.length) diff.push(`${b.session} ${k}: ${String(x.length)} vs ${String(y.length)} counted findings`);
  }
}
const counts = (o: Out): Record<string, Record<string, { seed: number; final: number; newIds: number }>> => {
  const out: Record<string, Record<string, { seed: number; final: number; newIds: number }>> = {};
  for (const s of o.sessions) {
    const seedIds = new Set(s.seed.map(identity));
    const newIds = new Map<string, Set<string>>();
    for (const [k, xs] of [['seed', s.seed], ['final', s.final]] as const) {
      for (const f of xs) {
        const sh = shapeOf(f);
        const c = ((out[s.arm] ??= {})[sh] ??= { seed: 0, final: 0, newIds: 0 });
        c[k] += 1;
        if (k === 'final' && !seedIds.has(identity(f))) (newIds.get(sh) ?? newIds.set(sh, new Set()).get(sh)!).add(identity(f));
      }
    }
    for (const [sh, ids] of newIds) out[s.arm]![sh]!.newIds += ids.size;
  }
  return out;
};
process.stdout.write(`${JSON.stringify({ sessions: before.sessions.length, countedShapes: counted, countedShapeDiff: diff, before: counts(before), after: counts(after) }, null, 1)}\n`);
process.exit(diff.length === 0 ? 0 : 1);
