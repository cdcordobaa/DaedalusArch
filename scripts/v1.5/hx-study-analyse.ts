/**
 * v1.5 Hexagonal study analysis, zero calls (DRAFT pre-registration `Docs/v1.5/hexagonal-study-preregistration.md` §4).
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --cells <cells.json> --out <dir>
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --planted <effect|null> --out <dir> [--reps 8]
 *   npx tsx scripts/v1.5/hx-study-analyse.ts --power --out <dir> [--draws 400]
 * `cells.json` is `{ "cells": HxCell[] }`. `--planted` writes synthetic cells first (registration test, scenario B of
 * §3, RR 0.25 for `effect`, RR 1 for `null`). `--power` writes the §3 table.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { dropFlagged, dropNoTrap, halves, pairedBooleanSign, rate } from './lib/final-study-analyse';
import { analyseHx, decideHx, dropTasksWithoutTrap, hxBlocks, jointReading, jointTable, plantedHx, powerHx, semSecondary, type HxCell } from './lib/hx-study-analyse';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const out = argOf('--out') ?? 'results/v1.5-hx-study/analysis';
fs.mkdirSync(out, { recursive: true });

/** §3 scenarios: per-task trap probability over the 13 tasks (sources in §3). */
export const SCENARIOS: Readonly<Record<string, readonly number[]>> = {
  'A: all 13 at 0.31 (TRAPRATE-01 Hex, 8/26)': Array.from({ length: 13 }, () => 0.31),
  'B: 8 at 0.33 (ladder L2, 4/12), 5 at 0': [...Array.from({ length: 8 }, () => 0.33), ...Array.from({ length: 5 }, () => 0)],
  'C: 8 at 0.58 (ladder L3, 7/12), 5 at 0': [...Array.from({ length: 8 }, () => 0.58), ...Array.from({ length: 5 }, () => 0)],
};
export const DETECT = [0.4, 1] as const; // TRAPRATE-01: Hexagonal trapped runs flagged by admitted rules 2/5; upper bound 1
export const REPS = [4, 6, 8, 10] as const;
export const KEEPS = [0.5, 0.25] as const;

if (process.argv.includes('--power')) {
  const draws = Number(argOf('--draws') ?? 400);
  const rows: string[] = ['| Scenario | detect | r | turns | power RR 0.5 | power RR 0.25 | null: false support | median tasks with nonzero sum (RR 0.25) |', '|---|---|---|---|---|---|---|---|'];
  const json: unknown[] = [];
  for (const [name, pTrap] of Object.entries(SCENARIOS)) for (const detect of DETECT) for (const reps of REPS) {
    const [half, quarter] = KEEPS.map((keep) => powerHx({ pTrap, reps, keep, detect, draws }));
    const nul = powerHx({ pTrap, reps, keep: 1, detect, draws });
    rows.push(`| ${name} | ${String(detect)} | ${String(reps)} | ${String(13 * reps * 2 * 3)} | ${half!.power.toFixed(2)} | ${quarter!.power.toFixed(2)} | ${nul.power.toFixed(3)} | ${String(quarter!.medianNonzeroTasks)} |`);
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
  cells = plantedHx({ pTrap: SCENARIOS['C: 8 at 0.58 (ladder L3, 7/12), 5 at 0']!, reps, keep: plantedKind === 'null' ? 1 : 0.25, detect: 1, ids: 2 });
} else {
  const f = argOf('--cells');
  if (f === undefined) throw new Error('--cells <file>, --planted <effect|null> or --power');
  cells = (JSON.parse(fs.readFileSync(f, 'utf8')) as { cells: HxCell[] }).cells;
}

const bs = hxBlocks(cells);
const one = (b: typeof bs): { result: ReturnType<typeof analyseHx>; decision: ReturnType<typeof decideHx> } => { const result = analyseHx(b); return { result, decision: decideHx(result) }; };
const primary = one(bs);
const sensitivity = { dropTasksWithoutTrap: one(dropTasksWithoutTrap(bs)), firstStudyDropNoTrapBiased: one(dropNoTrap(bs)), dropFlagged: one(dropFlagged(bs)), firstHalf: one(halves(bs).first), secondHalf: one(halves(bs).second) };
const secondary = {
  sem: semSecondary(cells),
  trapRate: rate(cells, 'hexagonal', (c) => c.trapFailed), trapPairedSign: pairedBooleanSign(bs, (c) => c.trapFailed),
  acceptance: rate(cells, 'hexagonal', (c) => c.accepted), pZero: rate(cells, 'hexagonal', (c) => (c.D === null ? null : c.D === 0)),
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
lines.push('', `Secondary R-MIRROR-SEM: ΣDsem none ${String(secondary.sem.sumNone)}, combined ${String(secondary.sem.sumCombined)}, exact p ${secondary.sem.pExact.toExponential(2)} (no decision)`);
fs.writeFileSync(path.join(out, 'tables.md'), `${lines.join('\n')}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
