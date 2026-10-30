/**
 * v1.5 Hexagonal study analysis, zero calls (DRAFT pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §4).
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --cells <cells.json> --out <dir>
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --planted <effect|null> --out <dir> [--reps 8]
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --power --out <dir> [--draws 400]
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --power-d9 --out <dir>
 * `cells.json` is `{ "cells": HxCell[] }`. `--planted` writes synthetic cells first (registration test, scenario C of
 * §3 over the 11 study tasks, RR 0.25 for `effect`, RR 1 for `null`). `--power` writes the §3 table; `--power-d9`
 * applies the registered r rule (D9) and writes `d9.json`.
 * The study has 11 tasks (B11: hxpb1 and hxpb2 dropped) and no R-MIRROR-SEM secondary.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dropFlagged, dropNoTrap, halves, pairedBooleanSign, rate } from './lib/final-study-analyse';
import { D9, analyseHx, d9Rule, decideHx, dropTasksWithoutTrap, hxBlocks, jointReading, jointTable, plantedHx, powerHx, type HxCell } from './lib/hx-study-analyse';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const out = argOf('--out') ?? 'results/v1.5-hx-study/analysis';
fs.mkdirSync(out, { recursive: true });

/** §3 scenarios: per-task trap probability over the 11 study tasks (sources in §3). */
export const SCENARIOS: Readonly<Record<string, readonly number[]>> = {
  'A: all 11 at 0.31 (TRAPRATE-01 Hex, 8/26)': Array.from({ length: 11 }, () => 0.31),
  'B: 8 at 0.33 (ladder L2, 4/12), 3 at 0': [...Array.from({ length: 8 }, () => 0.33), ...Array.from({ length: 3 }, () => 0)],
  'C: 8 at 0.58 (ladder L3, 7/12), 3 at 0': [...Array.from({ length: 8 }, () => 0.58), ...Array.from({ length: 3 }, () => 0)],
};
// TRAPRATE-01: Hexagonal trapped runs flagged by admitted rules 2/5; HX-COVERAGE option (i) 14/19; upper bound 1
export const DETECT = [0.4, D9.detect, 1] as const;
export const REPS = [4, 6, 8, 10] as const;
export const KEEPS = [0.5, 0.25] as const;

if (process.argv.includes('--power-d9')) {
  const scen = Object.fromEntries(Object.entries(SCENARIOS).map(([name, pTrap]) => [name, Object.fromEntries([D9.base, D9.fallback].map((reps) => [String(reps), powerHx({ pTrap, reps, keep: D9.keep, detect: D9.detect, ids: D9.ids, draws: D9.draws }).power]))]));
  const res = { rule: D9, ...d9Rule(), scenariosBesideIt: scen };
  fs.writeFileSync(path.join(out, 'd9.json'), `${JSON.stringify(res, null, 1)}\n`);
  process.stdout.write(`${JSON.stringify(res, null, 1)}\n`);
  process.exit(0);
}

if (process.argv.includes('--power')) {
  const draws = Number(argOf('--draws') ?? 400);
  const rows: string[] = ['| Scenario | detect | r | turns | power RR 0.5 | power RR 0.25 | null: false support | median tasks with nonzero sum (RR 0.25) |', '|---|---|---|---|---|---|---|---|'];
  const json: unknown[] = [];
  for (const [name, pTrap] of Object.entries(SCENARIOS)) for (const detect of DETECT) for (const reps of REPS) {
    const [half, quarter] = KEEPS.map((keep) => powerHx({ pTrap, reps, keep, detect, draws }));
    const nul = powerHx({ pTrap, reps, keep: 1, detect, draws });
    rows.push(`| ${name} | ${detect.toFixed(2)} | ${String(reps)} | ${String(11 * reps * 2 * 3)} | ${half!.power.toFixed(2)} | ${quarter!.power.toFixed(2)} | ${nul.power.toFixed(3)} | ${String(quarter!.medianNonzeroTasks)} |`);
    json.push({ scenario: name, detect, reps, half, quarter, nul });
  }
  fs.writeFileSync(path.join(out, 'power.json'), `${JSON.stringify({ draws, rows: json }, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'power.md'), `${rows.join('\n')}\n`);
  process.stdout.write(`${rows.join('\n')}\n`);
  process.exit(0);
}

const plantedKind = argOf('--planted');
let cells: HxCell[];
if (plantedKind !== undefined) {
  const reps = Number(argOf('--reps') ?? 8);
  cells = plantedHx({ pTrap: SCENARIOS['C: 8 at 0.58 (ladder L3, 7/12), 3 at 0']!, reps, keep: plantedKind === 'null' ? 1 : 0.25, detect: 1, ids: 2 });
} else {
  const f = argOf('--cells');
  if (f === undefined) throw new Error('--cells <file>, --planted <effect|null> or --power');
  cells = (JSON.parse(fs.readFileSync(f, 'utf8')) as { cells: HxCell[] }).cells;
}

const prim = cells;
const bs = hxBlocks(prim);
const one = (b: typeof bs): { result: ReturnType<typeof analyseHx>; decision: ReturnType<typeof decideHx> } => { const result = analyseHx(b); return { result, decision: decideHx(result) }; };
const primary = one(bs);
const sensitivity = { dropTasksWithoutTrap: one(dropTasksWithoutTrap(bs)), firstStudyDropNoTrapBiased: one(dropNoTrap(bs)), dropFlagged: one(dropFlagged(bs)), firstHalf: one(halves(bs).first), secondHalf: one(halves(bs).second) };
const secondary = {
  trapRate: rate(prim, 'hexagonal', (c) => c.trapFailed), trapPairedSign: pairedBooleanSign(bs, (c) => c.trapFailed),
  acceptance: rate(prim, 'hexagonal', (c) => c.accepted), pZero: rate(prim, 'hexagonal', (c) => (c.D === null ? null : c.D === 0)),
  jointTable: jointTable(bs),
};
const joint = jointReading(primary.decision, secondary.trapPairedSign);
fs.writeFileSync(path.join(out, 'analysis.json'), `${JSON.stringify({ input: plantedKind ? `planted:${plantedKind}` : argOf('--cells'), primary, joint, sensitivity, secondary }, null, 1)}\n`);
const f = (x: number | null | undefined, d = 3): string => (x === null || x === undefined || Number.isNaN(x) ? '—' : x.toFixed(d));
const r = primary.result;
const lines = [
  '| blocks | tasks | ΣD none | ΣD combined | RR [within] | d̄ [within] | exact p | task sign (−/+/p) | reading |', '|---|---|---|---|---|---|---|---|---|',
  `| ${String(r.blocks)} | ${String(r.tasks)} | ${String(r.sumNone)} | ${String(r.sumCombined)} | ${f(r.rr, 2)} [${f(r.rrWithin?.low, 2)}, ${f(r.rrWithin?.high, 2)}] | ${f(r.dBar, 2)} [${f(r.dBarWithin?.low, 2)}, ${f(r.dBarWithin?.high, 2)}] | ${r.pExact.toExponential(2)} | ${String(r.taskSign.negative)}/${String(r.taskSign.positive)}/${r.taskSign.p.toExponential(2)} | ${primary.decision.reading} |`,
];
const jt = secondary.jointTable;
lines.push('', `Joint reading (§1): ${joint.reading} (trap paired sign: ${String(secondary.trapPairedSign.negative)} − / ${String(secondary.trapPairedSign.positive)} +, p ${secondary.trapPairedSign.p.toExponential(2)})`,
  '', '| per block | combined trap persisted | combined trap gone |', '|---|---|---|',
  `| D fell | ${String(jt.dFellTrapPersisted)} | ${String(jt.dFellTrapGone)} |`, `| D did not fall | ${String(jt.dNotFellTrapPersisted)} | ${String(jt.dNotFellTrapGone)} |`);
for (const [k, v] of Object.entries(sensitivity)) lines.push('', `Sensitivity ${k}: ${v.decision.reading} (p ${v.result.pExact.toExponential(2)}, ${String(v.result.blocks)} blocks)`);
fs.writeFileSync(path.join(out, 'tables.md'), `${lines.join('\n')}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
