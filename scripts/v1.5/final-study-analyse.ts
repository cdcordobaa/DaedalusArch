/**
 * v1.5 final study analysis, zero calls (pre-registration §4).
 *   npx tsx scripts/v1.5/final-study-analyse.ts --cells <cells.json> --out <dir>
 *   npx tsx scripts/v1.5/final-study-analyse.ts --planted <effect|null> --out <dir> [--reps 3] [--trap 0.6]
 * `cells.json` is `{ "cells": Cell[] }` (see lib); `--planted` writes synthetic cells first (registration test).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyse, blocksOf, decide, dropFlagged, dropNoTrap, halves, pairedBooleanSign, planted, rate, type Cell, type Block, type ContrastResult } from './lib/final-study-analyse';

const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const out = argOf('--out') ?? 'results/v1.5-final-study/analysis';
const plantedKind = argOf('--planted');
let cells: Cell[];
if (plantedKind !== undefined) {
  const reps = Number(argOf('--reps') ?? 3);
  const trap = Number(argOf('--trap') ?? 0.6);
  cells = planted({ tasks: { ddd: 12, hexagonal: 13 }, reps, trap, keep: plantedKind === 'null' ? 1 : 0.5 });
} else {
  const f = argOf('--cells');
  if (f === undefined) throw new Error('--cells <file> or --planted <effect|null>');
  cells = (JSON.parse(fs.readFileSync(f, 'utf8')) as { cells: Cell[] }).cells;
}

const run = (bs: Record<'H1' | 'H2', Block[]>): { results: ContrastResult[]; decisions: ReturnType<typeof decide> } => {
  const results = [analyse('H1', bs.H1), analyse('H2', bs.H2)];
  return { results, decisions: decide(results) };
};
const main = { H1: blocksOf(cells, 'ddd'), H2: blocksOf(cells, 'hexagonal') };
const primary = run(main);
const sens = {
  dropNoTrap: run({ H1: dropNoTrap(main.H1), H2: dropNoTrap(main.H2) }),
  dropFlagged: run({ H1: dropFlagged(main.H1), H2: dropFlagged(main.H2) }),
  firstHalf: run({ H1: halves(main.H1).first, H2: halves(main.H2).first }),
  secondHalf: run({ H1: halves(main.H1).second, H2: halves(main.H2).second }),
};
const secondary = Object.fromEntries((['ddd', 'hexagonal'] as const).map((s) => {
  const bs = s === 'ddd' ? main.H1 : main.H2;
  return [s, {
    trapRate: rate(cells, s, (c) => c.trapFailed), trapPairedSign: pairedBooleanSign(bs, (c) => c.trapFailed),
    acceptance: rate(cells, s, (c) => c.accepted),
    pZero: rate(cells, s, (c) => (c.D === null ? null : c.D === 0)),
  }];
}));

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'analysis.json'), `${JSON.stringify({ input: plantedKind ? `planted:${plantedKind}` : argOf('--cells'), primary, sensitivity: sens, secondary }, null, 1)}\n`);
const f = (x: number | null | undefined, d = 3): string => (x === null || x === undefined || Number.isNaN(x) ? '—' : x.toFixed(d));
const lines = ['| H | style | blocks | tasks | ΣD none | ΣD combined | RR [within] | d̄ [within] | exact p | task-level p | Holm α | reading |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const r of primary.results) {
  const d = primary.decisions.find((x) => x.id === r.id)!;
  lines.push(`| ${r.id} | ${r.style} | ${String(r.blocks)} | ${String(r.tasks)} | ${String(r.sumNone)} | ${String(r.sumCombined)} | ${f(r.rr, 2)} [${f(r.rrWithin?.low, 2)}, ${f(r.rrWithin?.high, 2)}] | ${f(r.dBar, 2)} [${f(r.dBarWithin?.low, 2)}, ${f(r.dBarWithin?.high, 2)}] | ${r.pExact.toExponential(2)} | ${r.taskLevel.pExact.toExponential(2)} | ${f(d.alphaStep, 4)} | ${d.reading} |`);
}
for (const [k, v] of Object.entries(sens)) lines.push('', `Sensitivity ${k}: ${v.decisions.map((d) => `${d.id} ${d.reading} (p ${d.p.toExponential(2)})`).join('; ')}`);
fs.writeFileSync(path.join(out, 'tables.md'), `${lines.join('\n')}\n`);
process.stdout.write(`${lines.join('\n')}\n`);
