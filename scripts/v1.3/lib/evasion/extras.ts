/**
 * Study 2 evasion check, the s2d-01 §5 lines the evasion report carries beside A1–A3 (design §2.5a):
 * - §5.2 size: LOC and source-file trajectories per cell, copied from the step records (no parsing);
 * - §5.3 coverage extras: import kinds (`import()`, `require()`, re-exports, ...) and barrels per snapshot, from
 *   `treeMeasures` of `scripts/v1.3/lib/snapshot-measures.ts` on the same trees A2 reads;
 * - §5.6 mechanism: the share of `daedalus-mcp` steps whose call log shows at least one tool call; steps with no log
 *   are counted apart; `noMechanism` below 0.8 (or with no log at all).
 */
import type { StepRecord } from '../../../lib/loop/types.js';
import { IMPORT_KINDS, emptyKinds, treeMeasures } from '../snapshot-measures.js';
import type { ImportKindCounts } from '../snapshot-measures.js';
import type { Tree } from './import-graph.js';

export const MECHANISM_MIN_SHARE = 0.8;

export interface StepStat {
  readonly n: number;
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

export function stat(values: readonly number[]): StepStat | null {
  if (values.length === 0) return null;
  return { n: values.length, mean: round(values.reduce((a, b) => a + b, 0) / values.length), min: Math.min(...values), max: Math.max(...values) };
}

function bySteps(values: ReadonlyMap<number, number[]>): Record<string, StepStat> {
  const out: Record<string, StepStat> = {};
  for (const step of [...values.keys()].sort((a, b) => a - b)) {
    const s = stat(values.get(step) ?? []);
    if (s !== null) out[String(step)] = s;
  }
  return out;
}

function push(m: Map<number, number[]>, k: number, v: number): void {
  const l = m.get(k) ?? [];
  l.push(v);
  m.set(k, l);
}

/** §5.2: LOC and source files of each step's final snapshot, over the runs of a cell (1-based steps). */
export function sizeByStep(runs: readonly (readonly StepRecord[])[], fromStep: number): { readonly locByStep: Record<string, StepStat>; readonly filesByStep: Record<string, StepStat> } {
  const loc = new Map<number, number[]>();
  const files = new Map<number, number[]>();
  for (const steps of runs) {
    for (const s of steps) {
      const step = s.stepIndex + 1;
      if (step < fromStep) continue;
      const snap = s.turns[s.turns.length - 1]?.snapshot;
      if (snap === undefined) continue;
      push(loc, step, snap.loc);
      push(files, step, snap.sourceFiles.length);
    }
  }
  return { locByStep: bySteps(loc), filesByStep: bySteps(files) };
}

export interface TreeKinds {
  readonly importKinds: ImportKindCounts;
  readonly barrels: number;
}

/** §5.3: import kinds and barrel count of one tree (its `src/**\/*.ts` source files). */
export function treeKinds(tree: Tree): TreeKinds {
  const m = treeMeasures(tree.files);
  return { importKinds: { ...m.importKinds }, barrels: m.barrels.length };
}

/** Per step, the summed import kinds and barrels over the runs of a cell, with the snapshot count. */
export function importKindsByStep(entries: readonly { readonly step: number; readonly kinds: TreeKinds }[]): {
  readonly byStep: Record<string, ImportKindCounts & { readonly snapshots: number }>;
  readonly barrelsByStep: Record<string, number>;
} {
  const by = new Map<number, { kinds: ImportKindCounts; barrels: number; n: number }>();
  for (const e of entries) {
    const cur = by.get(e.step) ?? { kinds: emptyKinds(), barrels: 0, n: 0 };
    for (const k of IMPORT_KINDS) cur.kinds[k] += e.kinds.importKinds[k];
    cur.barrels += e.kinds.barrels;
    cur.n++;
    by.set(e.step, cur);
  }
  const byStep: Record<string, ImportKindCounts & { snapshots: number }> = {};
  const barrelsByStep: Record<string, number> = {};
  for (const step of [...by.keys()].sort((a, b) => a - b)) {
    const v = by.get(step);
    if (v === undefined) continue;
    byStep[String(step)] = { ...v.kinds, snapshots: v.n };
    barrelsByStep[String(step)] = v.barrels;
  }
  return { byStep, barrelsByStep };
}

export interface Mechanism {
  readonly steps: number;
  readonly withCalls: number;
  /** Steps with no `process` block or a block whose log was not found. */
  readonly noLog: number;
  /** withCalls / (steps − noLog); null when no step has a log. */
  readonly share: number | null;
  readonly noMechanism: boolean;
}

/** §5.6 over the steps (from `fromStep`) of the `daedalus-mcp` runs of a cell. */
export function mechanism(runs: readonly (readonly StepRecord[])[], fromStep: number): Mechanism {
  let steps = 0;
  let withCalls = 0;
  let noLog = 0;
  for (const run of runs) {
    for (const s of run) {
      if (s.stepIndex + 1 < fromStep) continue;
      steps++;
      if (s.process === undefined || !s.process.logFound) {
        noLog++;
        continue;
      }
      if (s.process.calls > 0) withCalls++;
    }
  }
  const logged = steps - noLog;
  const share = logged === 0 ? null : round(withCalls / logged);
  return { steps, withCalls, noLog, share, noMechanism: share === null || share < MECHANISM_MIN_SHARE };
}
